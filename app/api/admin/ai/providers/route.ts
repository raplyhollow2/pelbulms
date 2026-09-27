import { NextRequest, NextResponse } from 'next/server'
import { deleteAiKey, resolveAiKeyRecord, upsertAiKey, type AiKeyMeta } from '@/lib/ai-keys'
import { requireSuperadmin } from '@/lib/ai/require-superadmin'
import { isLlmProvider, PROVIDER_LABELS, type LlmProvider } from '@/lib/ai/models'

function clean(value: unknown) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function hourlyCap(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.min(Math.floor(n), 10000)
}

/** PATCH /api/admin/ai/providers — save one school-wide language model. */
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const provider = body.provider as LlmProvider
  if (!isLlmProvider(provider)) {
    return NextResponse.json({ error: 'Choose Claude, Gemini, ChatGPT, or Copilot.' }, { status: 400 })
  }

  const existing = await resolveAiKeyRecord(provider)
  const incomingSecret = clean(body.secret)
  const secret = incomingSecret || existing?.secret
  const enabled = Boolean(body.enabled)
  const sent = (key: string) => (key in body ? clean(body[key]) : undefined)
  const meta: AiKeyMeta = {
    ...(existing?.meta || {}),
    model: 'model' in body ? sent('model') : existing?.meta.model,
    endpoint: 'endpoint' in body ? sent('endpoint') : existing?.meta.endpoint,
    deployment: 'deployment' in body ? sent('deployment') : existing?.meta.deployment,
    imageDeployment: 'imageDeployment' in body ? sent('imageDeployment') : existing?.meta.imageDeployment,
    hourlyCap: 'hourlyCap' in body ? hourlyCap(body.hourlyCap) : existing?.meta.hourlyCap,
    enabled,
  }
  if (provider === 'copilot') meta.model = meta.deployment

  if (!secret) {
    if (!enabled) return NextResponse.json({ success: true, provider, enabled: false })
    return NextResponse.json(
      { error: `${PROVIDER_LABELS[provider]} needs an API key before it can be enabled.` },
      { status: 400 }
    )
  }
  if (enabled && provider === 'copilot' && (!meta.endpoint || !meta.deployment)) {
    return NextResponse.json(
      { error: 'Microsoft Copilot needs an Azure endpoint and a deployment name.' },
      { status: 400 }
    )
  }

  try {
    const last4 = await upsertAiKey({
      provider,
      secret,
      userId: null,
      isPlatform: true,
      meta,
    })
    return NextResponse.json({ success: true, provider, last4, enabled: meta.enabled !== false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save the provider'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/admin/ai/providers — remove a school-wide key and leftover personal keys. */
export async function DELETE(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const provider = body.provider as LlmProvider
  if (!isLlmProvider(provider)) {
    return NextResponse.json({ error: 'Choose Claude, Gemini, ChatGPT, or Copilot.' }, { status: 400 })
  }

  try {
    await deleteAiKey({ provider, userId: null, isPlatform: true })
    return NextResponse.json({ success: true, provider })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not remove the provider key'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
