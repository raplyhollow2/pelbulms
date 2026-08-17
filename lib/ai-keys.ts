import { createServiceClient } from '@/lib/supabase/server'

export type AiProvider = 'gemini' | 'heygen' | 'did' | 'tavus'
export type AvatarProvider = 'heygen' | 'did' | 'tavus'

export const AVATAR_PROVIDERS: AvatarProvider[] = ['heygen', 'did', 'tavus']

export type AiKeyMeta = {
  avatarId?: string
  replicaId?: string
  sourceUrl?: string
}

export function last4Of(secret: string) {
  const trimmed = secret.trim()
  return trimmed.slice(-4)
}

function envFor(provider: AiProvider): string | null {
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
  if (provider === 'heygen') return process.env.HEYGEN_API_KEY || null
  if (provider === 'did') return process.env.DID_API_KEY || process.env.D_ID_API_KEY || null
  if (provider === 'tavus') return process.env.TAVUS_API_KEY || null
  return null
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
  userId?: string | null
): Promise<{ secret: string; meta: AiKeyMeta; source: 'user' | 'platform' | 'env' } | null> {
  const service = await createServiceClient()

  if (userId) {
    const { data: own } = await (service as any)
      .from('ai_provider_keys')
      .select('secret, meta')
      .eq('provider', provider)
      .eq('user_id', userId)
      .eq('is_platform', false)
      .maybeSingle()
    if (own?.secret) {
      return { secret: String(own.secret), meta: (own.meta || {}) as AiKeyMeta, source: 'user' }
    }
  }

  const { data: platform } = await (service as any)
    .from('ai_provider_keys')
    .select('secret, meta')
    .eq('provider', provider)
    .eq('is_platform', true)
    .maybeSingle()
  if (platform?.secret) {
    return {
      secret: String(platform.secret),
      meta: (platform.meta || {}) as AiKeyMeta,
      source: 'platform',
    }
  }

  const env = envFor(provider)
  if (!env) return null
  return {
    secret: env,
    meta: {
      avatarId: process.env.HEYGEN_AVATAR_ID || undefined,
      replicaId: process.env.TAVUS_REPLICA_ID || undefined,
      sourceUrl: process.env.DID_SOURCE_URL || undefined,
    },
    source: 'env',
  }
}

export async function resolveAvatarVendor(
  userId?: string | null,
  preferred?: AvatarProvider | null
): Promise<{ provider: AvatarProvider; secret: string; meta: AiKeyMeta; source: string } | null> {
  const order: AvatarProvider[] = preferred
    ? [preferred, ...AVATAR_PROVIDERS.filter((p) => p !== preferred)]
    : AVATAR_PROVIDERS
  for (const provider of order) {
    const row = await resolveAiKeyRecord(provider, userId)
    if (row?.secret) {
      return { provider, secret: row.secret, meta: row.meta, source: row.source }
    }
  }
  return null
}

function publicLast4(own: string | undefined, platform: string | undefined, envSet: boolean, isSuperadmin: boolean) {
  if (own) return own
  if (platform) return isSuperadmin ? platform : '****'
  if (envSet) return 'env'
  return null
}

export async function getAiKeyStatus(userId: string, isSuperadmin: boolean) {
  const service = await createServiceClient()
  const { data: ownRows } = await (service as any)
    .from('ai_provider_keys')
    .select('provider, last4, is_platform, meta')
    .eq('user_id', userId)
    .eq('is_platform', false)

  const { data: platformRows } = await (service as any)
    .from('ai_provider_keys')
    .select('provider, last4, is_platform, meta')
    .eq('is_platform', true)

  const own = Object.fromEntries((ownRows || []).map((r: any) => [r.provider, r]))
  const platform = Object.fromEntries((platformRows || []).map((r: any) => [r.provider, r]))

  const pack = (provider: AiProvider) => {
    const envSet = Boolean(envFor(provider))
    const ownRow = own[provider]
    const platRow = platform[provider]
    const configured = Boolean(ownRow?.last4 || platRow?.last4 || envSet)
    return {
      configured,
      last4: publicLast4(ownRow?.last4, platRow?.last4, envSet, isSuperadmin),
      source: ownRow?.last4 ? 'user' : platRow?.last4 ? 'platform' : envSet ? 'env' : null,
      meta: (ownRow?.meta || platRow?.meta || {}) as AiKeyMeta,
    }
  }

  return {
    gemini: pack('gemini'),
    heygen: pack('heygen'),
    did: pack('did'),
    tavus: pack('tavus'),
    avatarConfigured: Boolean(pack('heygen').configured || pack('did').configured || pack('tavus').configured),
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
  return last4
}

export async function updateAiKeyMeta(opts: {
  provider: AiProvider
  userId: string | null
  isPlatform: boolean
  meta: AiKeyMeta
}) {
  const service = await createServiceClient()
  let q = (service as any).from('ai_provider_keys').update({
    meta: opts.meta,
    updated_at: new Date().toISOString(),
  }).eq('provider', opts.provider)
  if (opts.isPlatform) q = q.eq('is_platform', true)
  else q = q.eq('user_id', opts.userId).eq('is_platform', false)
  const { data, error } = await q.select('last4').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Save an API key first, then you can update Avatar / Replica IDs.')
  return data.last4 as string
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
}

export async function validateVendorKey(provider: AiProvider, secret: string) {
  if (provider === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(secret)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
    const result = await model.generateContent('Reply with the single word OK.')
    if (!result.response.text()) throw new Error('Empty Gemini response. Check the key was copied fully.')
    return
  }
  if (provider === 'heygen') {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': secret, Accept: 'application/json' },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || data.error || 'HeyGen rejected this API key')
    }
    return
  }
  if (provider === 'did') {
    const auth = Buffer.from(`${secret}:`).toString('base64')
    const res = await fetch('https://api.d-id.com/credits', {
      headers: { Authorization: `Basic ${auth}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || data.kind || 'D-ID rejected this API key')
    }
    return
  }
  if (provider === 'tavus') {
    const res = await fetch('https://tavusapi.com/v2/replicas?limit=1', {
      headers: { 'x-api-key': secret },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || 'Tavus rejected this API key')
    }
  }
}
