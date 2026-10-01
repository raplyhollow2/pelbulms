/**
 * Opens a public Drive file as a stream the lesson player can play directly.
 * Range requests are forwarded so playback starts from the file header.
 * The response body is left unread for the caller to pipe.
 */
import { driveConfirmDownloadUrl, driveDownloadUrl, isDriveDownloadUrl } from '@/lib/drive-duration'

const FILE_ID_RE = /^[A-Za-z0-9_-]{10,128}$/
const HTML_CAP = 256 * 1024

function mergeCookies(existing: string, response: Response) {
  const jar = new Map<string, string>()
  for (const part of existing.split(';').map((item) => item.trim()).filter(Boolean)) {
    const eq = part.indexOf('=')
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1))
  }
  const setCookies =
    typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  for (const cookie of setCookies) {
    const pair = cookie.split(';')[0] || ''
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
}

async function cancel(response: Response) {
  try {
    await response.body?.cancel()
  } catch {
    /* already closed */
  }
}

async function request(url: string, range: string | null, cookie: string) {
  if (!isDriveDownloadUrl(url)) throw new Error('Rejected Drive URL')
  const headers: Record<string, string> = {
    Accept: '*/*',
    'User-Agent': 'Mozilla/5.0',
  }
  if (range) headers.Range = range
  if (cookie) headers.Cookie = cookie
  return fetch(url, { headers, redirect: 'manual' })
}

function isVideoResponse(response: Response) {
  if (response.status !== 200 && response.status !== 206) return false
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (!type) return true
  if (type.includes('html') || type.startsWith('text/') || type.includes('json') || type.includes('xml')) {
    return false
  }
  return type.startsWith('video/') || type.includes('octet-stream') || type.includes('mp4') || type.includes('binary')
}

async function readText(response: Response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (total < HTML_CAP) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = Buffer.from(value)
      chunks.push(chunk)
      total += chunk.length
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* already closed */
    }
  }
  return Buffer.concat(chunks).subarray(0, HTML_CAP).toString('utf8')
}

/** Upstream response for a public Drive video. Null when the file cannot be streamed. */
export async function openDriveVideo(fileId: string, range: string | null): Promise<Response | null> {
  if (!FILE_ID_RE.test(fileId)) return null
  let url = driveDownloadUrl(fileId)
  let cookie = ''
  for (let hop = 0; hop < 4; hop++) {
    const response = await request(url, range, cookie)
    cookie = mergeCookies(cookie, response)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await cancel(response)
      if (!location) return null
      const next = new URL(location, url).toString()
      if (!isDriveDownloadUrl(next)) return null
      url = next
      continue
    }
    const type = (response.headers.get('content-type') || '').toLowerCase()
    if (type.includes('html') || type.startsWith('text/')) {
      const next = driveConfirmDownloadUrl(await readText(response), fileId)
      if (!next) return null
      url = next
      continue
    }
    if (!isVideoResponse(response)) {
      await cancel(response)
      return null
    }
    return response
  }
  return null
}
