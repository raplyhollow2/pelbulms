import { NextRequest, NextResponse } from 'next/server'
import { enforceCapability, CAP } from '@/lib/rbac'
import { ADMIN_ROLES } from '@/lib/roles'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import {
  getCloudinaryAccount,
  getCloudinaryConnectionStatus,
  invalidateCloudinaryConfigCache,
  pingCloudinaryAccount,
} from '@/lib/cloudinary'

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

function last4(value: string) {
  return value.trim().slice(-4)
}

function readCredentials(body: Record<string, unknown>) {
  const cloudName = String(body.cloudName || '').trim()
  const apiKey = String(body.apiKey || '').trim()
  const apiSecret = String(body.apiSecret || '').trim()
  return { cloudName, apiKey, apiSecret }
}

async function requireSettings(request: NextRequest, write: boolean) {
  return enforceCapability(
    request,
    write ? CAP.SETTINGS_EDIT : CAP.SETTINGS_VIEW,
    ADMIN_ROLES
  )
}

/**
 * GET /api/admin/settings/cloudinary
 * Connection status only. The API secret is never returned.
 */
export async function GET(request: NextRequest) {
  const rbac = await requireSettings(request, false)
  if (!rbac.hasAccess) return denied(rbac)
  const status = await getCloudinaryConnectionStatus()
  return NextResponse.json(status)
}

/**
 * POST /api/admin/settings/cloudinary
 * Body: { action: 'test', cloudName, apiKey, apiSecret }
 * Checks credentials with Cloudinary and does not save them.
 */
export async function POST(request: NextRequest) {
  const rbac = await requireSettings(request, true)
  if (!rbac.hasAccess) return denied(rbac)

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (body.action !== 'test') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const creds = readCredentials(body)
  if (!creds.cloudName || !creds.apiKey || !creds.apiSecret) {
    return NextResponse.json(
      { error: 'Cloud name, API key, and API secret are required to test a connection' },
      { status: 400 }
    )
  }

  const pingError = await pingCloudinaryAccount(creds)
  if (pingError) return NextResponse.json({ error: pingError }, { status: 400 })
  return NextResponse.json({ ok: true })
}

/**
 * PUT /api/admin/settings/cloudinary
 * Saves a Cloudinary account after a successful ping. A different cloud name
 * requires confirmAccountSwitch so existing uploads are not orphaned silently.
 */
export async function PUT(request: NextRequest) {
  const rbac = await requireSettings(request, true)
  if (!rbac.hasAccess) return denied(rbac)

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const creds = readCredentials(body)
  if (!creds.cloudName || !creds.apiKey || !creds.apiSecret) {
    return NextResponse.json(
      { error: 'Cloud name, API key, and API secret are required' },
      { status: 400 }
    )
  }

  const current = await getCloudinaryAccount()
  if (
    current &&
    current.cloudName !== creds.cloudName &&
    body.confirmAccountSwitch !== true
  ) {
    return NextResponse.json(
      {
        error:
          'Switching Cloudinary accounts leaves existing uploads on the previous account. Confirm to continue.',
        code: 'account_switch_required',
        currentCloudName: current.cloudName,
      },
      { status: 409 }
    )
  }

  const pingError = await pingCloudinaryAccount(creds)
  if (pingError) return NextResponse.json({ error: pingError }, { status: 400 })

  const service = await tryCreateServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'The server cannot store Cloudinary credentials without the service role key' },
      { status: 503 }
    )
  }

  const { error } = await service.from('cloudinary_connection' as never).upsert({
    id: 'default',
    cloud_name: creds.cloudName,
    api_key: creds.apiKey,
    api_secret: creds.apiSecret,
    api_key_last4: last4(creds.apiKey),
    api_secret_last4: last4(creds.apiSecret),
    updated_at: new Date().toISOString(),
    updated_by: rbac.userId,
  } as never)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  invalidateCloudinaryConfigCache()
  const status = await getCloudinaryConnectionStatus()
  return NextResponse.json(status)
}

/**
 * DELETE /api/admin/settings/cloudinary
 * Removes the saved account. Environment variables are used again when present.
 */
export async function DELETE(request: NextRequest) {
  const rbac = await requireSettings(request, true)
  if (!rbac.hasAccess) return denied(rbac)

  const service = await tryCreateServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'The server cannot update Cloudinary credentials without the service role key' },
      { status: 503 }
    )
  }

  const { error } = await service
    .from('cloudinary_connection' as never)
    .delete()
    .eq('id', 'default')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  invalidateCloudinaryConfigCache()
  const status = await getCloudinaryConnectionStatus()
  return NextResponse.json(status)
}
