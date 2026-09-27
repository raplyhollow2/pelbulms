import { createServiceClient } from '@/lib/supabase/server'

export type AiProvider = 'gemini' | 'claude' | 'chatgpt' | 'copilot'
export type LanguageProvider = AiProvider

export const LANGUAGE_PROVIDERS: LanguageProvider[] = ['claude', 'gemini', 'chatgpt', 'copilot']

export function isLanguageProvider(provider: string): provider is LanguageProvider {
  return (LANGUAGE_PROVIDERS as string[]).includes(provider)
}

export type AiKeyMeta = {
  model?: string
  endpoint?: string
  deployment?: string
  imageDeployment?: string
  hourlyCap?: number | null
  enabled?: boolean
}

export function last4Of(secret: string) {
  const trimmed = secret.trim()
  return trimmed.slice(-4)
}

function envFor(provider: AiProvider): string | null {
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
  if (provider === 'claude') return process.env.ANTHROPIC_API_KEY || null
  if (provider === 'chatgpt') return process.env.OPENAI_API_KEY || null
  if (provider === 'copilot') return process.env.AZURE_OPENAI_API_KEY || null
  return null
}

function envMeta(provider: AiProvider): AiKeyMeta {
  if (provider === 'copilot') {
    return {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || undefined,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || undefined,
      imageDeployment: process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || undefined,
      model: process.env.AZURE_OPENAI_DEPLOYMENT || undefined,
    }
  }
  return {}
}

export async function resolveAiKey(
  provider: AiProvider,
  userId?: string | null
): Promise<string | null> {
  const row = await resolveAiKeyRecord(provider, userId)
  return row?.secret || null
}

export async function resolveAiKeyRecord(
  provider: AiProvider,
  _userId?: string | null
): Promise<{ secret: string; meta: AiKeyMeta; source: 'platform' | 'env' } | null> {
  const service = await createServiceClient()

  const { data: platform } = await (service as any)
    .from('ai_provider_keys')
    .select('secret, meta')
    .eq('provider', provider)
    .eq('is_platform', true)
    .maybeSingle()
  if (platform?.secret) {
    const meta = { ...envMeta(provider), ...((platform.meta || {}) as AiKeyMeta) }
    return {
      secret: String(platform.secret),
      meta,
      source: 'platform',
    }
  }

  const env = envFor(provider)
  if (!env) return null
  return {
    secret: env,
    meta: envMeta(provider),
    source: 'env',
  }
}

function publicLast4(platform: string | undefined, envSet: boolean, isSuperadmin: boolean) {
  if (platform) return isSuperadmin ? platform : '****'
  if (envSet) return 'env'
  return null
}

export async function getAiKeyStatus(_userId: string, isSuperadmin: boolean) {
  const service = await createServiceClient()
  const { data: platformRows } = await (service as any)
    .from('ai_provider_keys')
    .select('provider, last4, is_platform, meta')
    .eq('is_platform', true)

  const platform = Object.fromEntries((platformRows || []).map((r: any) => [r.provider, r]))

  const pack = (provider: AiProvider) => {
    const envSet = Boolean(envFor(provider))
    const platRow = platform[provider]
    const configured = Boolean(platRow?.last4 || envSet)
    const meta = { ...envMeta(provider), ...((platRow?.meta || {}) as AiKeyMeta) }
    return {
      configured,
      last4: publicLast4(platRow?.last4, envSet, isSuperadmin),
      source: platRow?.last4 ? 'platform' : envSet ? 'env' : null,
      meta,
      enabled: meta.enabled !== false && configured,
    }
  }

  return {
    claude: pack('claude'),
    gemini: pack('gemini'),
    chatgpt: pack('chatgpt'),
    copilot: pack('copilot'),
  }
}

export async function upsertAiKey(opts: {
  provider: AiProvider
  secret: string
  userId: string | null
  isPlatform: boolean
  meta?: AiKeyMeta
}) {
  const service = await createServiceClient()
  const last4 = last4Of(opts.secret)
  const payload = {
    provider: opts.provider,
    secret: opts.secret.trim(),
    last4,
    meta: opts.meta || {},
    user_id: opts.isPlatform ? null : opts.userId,
    is_platform: opts.isPlatform,
    updated_at: new Date().toISOString(),
  }

  if (opts.isPlatform) {
    const { data: existing } = await (service as any)
      .from('ai_provider_keys')
      .select('id')
      .eq('provider', opts.provider)
      .eq('is_platform', true)
      .maybeSingle()
    if (existing?.id) {
      const { error } = await (service as any)
        .from('ai_provider_keys')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
      await purgeNonPlatformAiKeys()
      return last4
    }
  } else {
    const { data: existing } = await (service as any)
      .from('ai_provider_keys')
      .select('id')
      .eq('provider', opts.provider)
      .eq('user_id', opts.userId)
      .eq('is_platform', false)
      .maybeSingle()
    if (existing?.id) {
      const { error } = await (service as any)
        .from('ai_provider_keys')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
      return last4
    }
  }

  const { error } = await (service as any).from('ai_provider_keys').insert(payload)
  if (error) throw error
  if (opts.isPlatform) await purgeNonPlatformAiKeys()
  return last4
}

export async function deleteAiKey(opts: {
  provider: AiProvider
  userId: string | null
  isPlatform: boolean
}) {
  const service = await createServiceClient()
  let q = (service as any).from('ai_provider_keys').delete().eq('provider', opts.provider)
  if (opts.isPlatform) q = q.eq('is_platform', true)
  else q = q.eq('user_id', opts.userId).eq('is_platform', false)
  const { error } = await q
  if (error) throw error
  if (opts.isPlatform) await purgeNonPlatformAiKeys()
}

/** Personal keys are no longer used. Remove leftovers so they cannot stay stranded. */
export async function purgeNonPlatformAiKeys() {
  const service = await createServiceClient()
  const { error } = await (service as any).from('ai_provider_keys').delete().eq('is_platform', false)
  if (error) throw error
}
