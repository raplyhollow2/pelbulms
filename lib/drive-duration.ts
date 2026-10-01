/**
 * Reads a public Drive video's length from a few kilobytes of the file header.
 */

const FILE_ID_RE = /^[A-Za-z0-9_-]{10,128}$/
const HEAD_BYTES = 512 * 1024
const TAIL_BYTES = 512 * 1024
const HTML_BYTES = 256 * 1024
const MAX_SECONDS = 60 * 60 * 24

export function driveDownloadUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`
}

export function isDriveDownloadUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    if (url.hostname === 'drive.usercontent.google.com' && url.pathname === '/download') return true
    if (url.hostname === 'drive.google.com' && url.pathname === '/uc') return true
    return false
  } catch {
    return false
  }
}

/** Confirm page from a large public file. Returns a download URL, never the file bytes. */
export function driveConfirmDownloadUrl(html: string, fileId: string): string | null {
  const decoded = html.replace(/&amp;/g, '&')
  const absolute = decoded.match(
    /https:\/\/drive\.usercontent\.google\.com\/download\?[^"'\\\s<]+/i
  )
  if (absolute?.[0] && isDriveDownloadUrl(absolute[0])) return absolute[0]
  const relative = decoded.match(/\/uc\?export=download[^"'\\\s<]+/i)
  if (relative?.[0]) {
    const url = `https://drive.google.com${relative[0]}`
    if (isDriveDownloadUrl(url)) return url
  }
  const uuid = decoded.match(/name="uuid"\s+value="([^"]+)"/i)?.[1]
  const confirm = decoded.match(/name="confirm"\s+value="([^"]+)"/i)?.[1]
  if (!confirm || !FILE_ID_RE.test(fileId)) return null
  const params = new URLSearchParams({ id: fileId, export: 'download', confirm })
  if (uuid) params.set('uuid', uuid)
  return `https://drive.usercontent.google.com/download?${params}`
}

/** Seconds from an MP4/MOV `mvhd` atom, or null when the header is not in this slice. */
export function parseMp4DurationSeconds(bytes: Uint8Array): number | null {
  const buf = Buffer.from(bytes)
  const idx = buf.indexOf('mvhd')
  if (idx < 0) return null
  const version = buf[idx + 4]
  let timescale = 0
  let duration = 0
  if (version === 0) {
    if (idx + 24 > buf.length) return null
    timescale = buf.readUInt32BE(idx + 16)
    duration = buf.readUInt32BE(idx + 20)
  } else if (version === 1) {
    if (idx + 36 > buf.length) return null
    timescale = buf.readUInt32BE(idx + 24)
    duration = Number(buf.readBigUInt64BE(idx + 28))
  } else {
    return null
  }
  if (!(timescale > 0) || !(duration > 0)) return null
  const seconds = duration / timescale
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_SECONDS) return null
  return Math.round(seconds)
}

async function cancel(response: Response) {
  try {
    await response.body?.cancel()
  } catch {
    /* already closed */
  }
}

/** Reads at most `maxBytes`, then cancels. A long file is never pulled down. */
async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (total < maxBytes) {
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
  return Buffer.concat(chunks).subarray(0, maxBytes)
}

function totalFromContentRange(header: string | null): number | null {
  const match = header?.match(/\/(\d+)\s*$/)
  const total = match ? Number(match[1]) : NaN
  return Number.isFinite(total) && total > 0 ? total : null
}

async function fetchSlice(url: string, start: number, end: number, signal: AbortSignal) {
  let current = url
  for (let hop = 0; hop < 3; hop++) {
    if (!isDriveDownloadUrl(current)) throw new Error('Rejected Drive URL')
    const response = await fetch(current, {
      signal,
      redirect: 'manual',
      headers: {
        Range: `bytes=${start}-${end}`,
        Accept: 'video/mp4,video/*,application/octet-stream;q=0.9,*/*;q=0.1',
        'User-Agent': 'Mozilla/5.0',
      },
    })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    await cancel(response)
    if (!location) return response
    current = new URL(location, current).toString()
  }
  throw new Error('Too many Drive redirects')
}

async function sliceBytes(url: string, start: number, end: number, signal: AbortSignal) {
  const response = await fetchSlice(url, start, end, signal)
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (type.includes('html') || type.startsWith('text/')) {
    const html = (await readCapped(response, HTML_BYTES)).toString('utf8')
    return { html, bytes: null as Buffer | null, total: null as number | null }
  }
  if (response.status !== 200 && response.status !== 206) {
    await cancel(response)
    return { html: '', bytes: null as Buffer | null, total: null as number | null }
  }
  const total = totalFromContentRange(response.headers.get('content-range'))
  const bytes = await readCapped(response, end - start + 1)
  const head = bytes.subarray(0, 64).toString('utf8').trimStart().toLowerCase()
  if (head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head')) {
    return { html: bytes.toString('utf8'), bytes: null, total: null }
  }
  return { html: '', bytes, total }
}

export async function fetchDriveDurationSeconds(fileId: string): Promise<number | null> {
  if (!FILE_ID_RE.test(fileId)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    let url = driveDownloadUrl(fileId)
    let slice = await sliceBytes(url, 0, HEAD_BYTES - 1, controller.signal)
    if (slice.html) {
      const next = driveConfirmDownloadUrl(slice.html, fileId)
      if (!next) return null
      url = next
      slice = await sliceBytes(url, 0, HEAD_BYTES - 1, controller.signal)
    }
    const head = slice.bytes ? parseMp4DurationSeconds(slice.bytes) : null
    if (head) return head
    const total = slice.total
    if (!total || total <= HEAD_BYTES) return null
    const tailStart = Math.max(0, total - TAIL_BYTES)
    const tail = await sliceBytes(url, tailStart, total - 1, controller.signal)
    return tail.bytes ? parseMp4DurationSeconds(tail.bytes) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
