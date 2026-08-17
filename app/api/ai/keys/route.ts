// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import {
  deleteAiKey,
  getAiKeyStatus,
  updateAiKeyMeta,
  upsertAiKey,
  validateVendorKey,
  type AiProvider,
  type AiKeyMeta,
} from '@/lib/ai-keys'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const
const PROVIDERS: AiProvider[] = ['gemini', 'heygen', 'did', 'tavus']

export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const status = await getAiKeyStatus(rbac.userId!, rbac.userRole === 'superadmin')
  return NextResponse.json(status)
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const provider = (body.provider || 'gemini') as AiProvider
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
  }
  const secret = String(body.secret || '').trim()
  const isPlatform = Boolean(body.platform)
  if (isPlatform && rbac.userRole !== 'superadmin') {
    return NextResponse.json({ error: 'Only superadmin can set a platform key' }, { status: 403 })
  }

  const meta: AiKeyMeta = {
    avatarId: String(body.avatarId || body.meta?.avatarId || '').trim() || undefined,
    replicaId: String(body.replicaId || body.meta?.replicaId || '').trim() || undefined,
    sourceUrl: String(body.sourceUrl || body.meta?.sourceUrl || '').trim() || undefined,
  }

  try {
    if (!secret) {
      if (provider === 'gemini') {
        return NextResponse.json({ error: 'secret is required' }, { status: 400 })
      }
      const last4 = await updateAiKeyMeta({
        provider,
        userId: rbac.userId!,
        isPlatform,
        meta,
      })
      return NextResponse.json({ success: true, last4, provider, platform: isPlatform, metaOnly: true })
    }
    await validateVendorKey(provider, secret)
    const last4 = await upsertAiKey({
      provider,
      secret,
      userId: rbac.userId!,
      isPlatform,
      meta,
    })
    return NextResponse.json({ success: true, last4, provider, platform: isPlatform })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Could not save or validate the API key' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const provider = (body.provider || 'gemini') as AiProvider
  const isPlatform = Boolean(body.platform)
  if (isPlatform && rbac.userRole !== 'superadmin') {
    return NextResponse.json({ error: 'Only superadmin can remove a platform key' }, { status: 403 })
  }
  await deleteAiKey({ provider, userId: rbac.userId!, isPlatform })
  return NextResponse.json({ success: true })
}
