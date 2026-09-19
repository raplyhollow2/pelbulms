const DEFAULT_REPO = 'raplyhollow2/pelbulms'
const DEFAULT_TAG = 'android-latest'
const DEFAULT_ASSET = 'pelbu-lms.apk'

export type AndroidRelease = {
  available: boolean
  version: string | null
  publishedAt: string | null
  sizeBytes: number | null
  downloadPath: string
  sourceUrl: string | null
  message?: string
}

function repo() {
  return process.env.ANDROID_GITHUB_REPO || DEFAULT_REPO
}

function tag() {
  return process.env.ANDROID_RELEASE_TAG || DEFAULT_TAG
}

function assetName() {
  return process.env.ANDROID_APK_ASSET_NAME || DEFAULT_ASSET
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pelbu-lms-android-download',
  }
  const token = process.env.ANDROID_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export function publicGithubDownloadUrl() {
  if (process.env.ANDROID_APK_URL) return process.env.ANDROID_APK_URL
  return `https://github.com/${repo()}/releases/download/${tag()}/${assetName()}`
}

export async function getAndroidRelease(): Promise<AndroidRelease> {
  const downloadPath = '/api/android/apk'
  const override = process.env.ANDROID_APK_URL
  if (override) {
    return {
      available: true,
      version: process.env.ANDROID_APK_VERSION || tag(),
      publishedAt: null,
      sizeBytes: null,
      downloadPath,
      sourceUrl: override,
    }
  }

  const apiUrl = `https://api.github.com/repos/${repo()}/releases/tags/${tag()}`
  try {
    const res = await fetch(apiUrl, { headers: githubHeaders(), cache: 'no-store' })
    if (res.status === 404) {
      return {
        available: false,
        version: null,
        publishedAt: null,
        sizeBytes: null,
        downloadPath,
        sourceUrl: null,
        message: 'The Android APK has not been published yet. Run the Build Android APK GitHub Action.',
      }
    }
    if (!res.ok) {
      return {
        available: false,
        version: null,
        publishedAt: null,
        sizeBytes: null,
        downloadPath,
        sourceUrl: null,
        message: 'Could not read the Android release right now. Try again in a minute.',
      }
    }
    const body = (await res.json()) as {
      name?: string
      tag_name?: string
      published_at?: string
      assets?: { name: string; size: number; url: string; browser_download_url: string }[]
    }
    const asset = body.assets?.find((item) => item.name === assetName()) || body.assets?.[0]
    if (!asset) {
      return {
        available: false,
        version: body.tag_name || null,
        publishedAt: body.published_at || null,
        sizeBytes: null,
        downloadPath,
        sourceUrl: null,
        message: 'The latest Android release does not include an APK yet.',
      }
    }
    return {
      available: true,
      version: body.name || body.tag_name || tag(),
      publishedAt: body.published_at || null,
      sizeBytes: asset.size,
      downloadPath,
      sourceUrl: asset.browser_download_url,
    }
  } catch {
    return {
      available: false,
      version: null,
      publishedAt: null,
      sizeBytes: null,
      downloadPath,
      sourceUrl: null,
      message: 'Could not reach GitHub to look up the Android APK.',
    }
  }
}

export async function fetchAndroidApk(): Promise<{
  ok: boolean
  status: number
  body: ArrayBuffer | null
  filename: string
  contentType: string
  error?: string
}> {
  const filename = assetName()
  const contentType = 'application/vnd.android.package-archive'
  const override = process.env.ANDROID_APK_URL
  const url = override || publicGithubDownloadUrl()

  const headers: Record<string, string> = {
    Accept: 'application/octet-stream',
    'User-Agent': 'pelbu-lms-android-download',
  }
  const token = process.env.ANDROID_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  if (token && !override) headers.Authorization = `Bearer ${token}`

  try {
    const apiUrl = `https://api.github.com/repos/${repo()}/releases/tags/${tag()}`
    if (!override && token) {
      const meta = await fetch(apiUrl, { headers: githubHeaders(), cache: 'no-store' })
      if (meta.ok) {
        const body = (await meta.json()) as {
          assets?: { name: string; url: string }[]
        }
        const asset = body.assets?.find((item) => item.name === filename) || body.assets?.[0]
        if (asset?.url) {
          const assetRes = await fetch(asset.url, {
            headers: {
              ...headers,
              Accept: 'application/octet-stream',
            },
            cache: 'no-store',
            redirect: 'follow',
          })
          if (assetRes.ok) {
            return {
              ok: true,
              status: 200,
              body: await assetRes.arrayBuffer(),
              filename,
              contentType,
            }
          }
        }
      }
    }

    const res = await fetch(url, { headers, cache: 'no-store', redirect: 'follow' })
    if (!res.ok) {
      return {
        ok: false,
        status: res.status === 404 ? 404 : 502,
        body: null,
        filename,
        contentType,
        error:
          res.status === 404
            ? 'Android APK is not published yet.'
            : 'Failed to download the Android APK.',
      }
    }
    return {
      ok: true,
      status: 200,
      body: await res.arrayBuffer(),
      filename,
      contentType,
    }
  } catch {
    return {
      ok: false,
      status: 502,
      body: null,
      filename,
      contentType,
      error: 'Failed to download the Android APK.',
    }
  }
}

export function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
