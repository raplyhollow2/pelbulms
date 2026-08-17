import type { AiKeyMeta, AvatarProvider } from '@/lib/ai-keys'

export type AvatarJob = {
  provider: AvatarProvider
  url?: string | null
  jobId?: string | null
  raw: unknown
}

export async function generateAvatarVideo(opts: {
  provider: AvatarProvider
  secret: string
  script: string
  meta?: AiKeyMeta
}): Promise<AvatarJob> {
  const script = opts.script.slice(0, 4000)
  if (opts.provider === 'heygen') return generateHeygen(opts.secret, script, opts.meta)
  if (opts.provider === 'did') return generateDid(opts.secret, script, opts.meta)
  return generateTavus(opts.secret, script, opts.meta)
}

async function generateHeygen(secret: string, script: string, meta?: AiKeyMeta): Promise<AvatarJob> {
  const avatarId = meta?.avatarId || process.env.HEYGEN_AVATAR_ID
  if (!avatarId) {
    throw new Error(
      'HeyGen needs an Avatar ID. Paste it in Settings → AI next to your HeyGen API key (HeyGen → Avatars → copy ID).'
    )
  }
  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': secret,
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: 'avatar', avatar_id: avatarId },
          voice: { type: 'text', input_text: script },
        },
      ],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(formatVendorError('HeyGen', data))
  }
  return {
    provider: 'heygen',
    url: data.data?.video_url || data.data?.url || data.video_url || null,
    jobId: data.data?.video_id || data.data?.id || null,
    raw: data,
  }
}

async function generateDid(secret: string, script: string, meta?: AiKeyMeta): Promise<AvatarJob> {
  const sourceUrl = meta?.sourceUrl || process.env.DID_SOURCE_URL
  if (!sourceUrl) {
    throw new Error(
      'D-ID needs a presenter image URL. Paste it in Settings → AI next to your D-ID API key.'
    )
  }
  const auth = Buffer.from(`${secret}:`).toString('base64')
  const res = await fetch('https://api.d-id.com/talks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      script: { type: 'text', input: script, provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' } },
      source_url: sourceUrl,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(formatVendorError('D-ID', data))
  }
  return {
    provider: 'did',
    url: data.result_url || data.audio_url || null,
    jobId: data.id || null,
    raw: data,
  }
}

async function generateTavus(secret: string, script: string, meta?: AiKeyMeta): Promise<AvatarJob> {
  const replicaId = meta?.replicaId || process.env.TAVUS_REPLICA_ID
  if (!replicaId) {
    throw new Error(
      'Tavus needs a Replica ID. Paste it in Settings → AI next to your Tavus API key.'
    )
  }
  const res = await fetch('https://tavusapi.com/v2/videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': secret,
    },
    body: JSON.stringify({
      replica_id: replicaId,
      script,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(formatVendorError('Tavus', data))
  }
  return {
    provider: 'tavus',
    url: data.download_url || data.hosted_url || data.video_url || null,
    jobId: data.video_id || data.id || null,
    raw: data,
  }
}

function formatVendorError(name: string, data: any) {
  const msg =
    data?.error?.message ||
    data?.message ||
    data?.kind ||
    (typeof data?.error === 'string' ? data.error : null) ||
    `${name} request failed`
  return msg
}
