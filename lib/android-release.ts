const DEFAULT_REPO = 'raplyhollow2/pelbulms'
const DEFAULT_ASSET = 'pelbu-lms.apk'
/** Prefer versioned tags: android-v1.2.3. android-latest is a floating pointer. */
const TAG_PREFIX = 'android-v'

export type AndroidRelease = {
  available: boolean
  version: string | null
  versionCode: number | null
  tag: string | null
  publishedAt: string | null
  sizeBytes: number | null
  downloadPath: string
  sourceUrl: string | null
  filename: string | null
  message?: string
}

function repo() {
  return process.env.ANDROID_GITHUB_REPO || DEFAULT_REPO
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

function parseSemver(tag: string): [number, number, number] | null {
  const m = tag.match(/^android-v(\d+)\.(\d+)\.(\d+)$/i)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function compareSemverDesc(a: string, b: string) {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i]
  }
  return 0
}

function versionCodeFromNotes(body: string | undefined | null): number | null {
  if (!body) return null
  const m = body.match(/versionCode[:\s*]*\*?\*?(\d+)/i)
  return m ? Number(m[1]) : null
}

type GhRelease = {
  name?: string
  tag_name?: string
  body?: string
  published_at?: string
  draft?: boolean
  prerelease?: boolean
  assets?: { name: string; size: number; url: string; browser_download_url: string }[]
}

async function listAndroidReleases(): Promise<GhRelease[]> {
  const apiUrl = `https://api.github.com/repos/${repo()}/releases?per_page=30`
  const res = await fetch(apiUrl, { headers: githubHeaders(), cache: 'no-store' })
  if (!res.ok) return []
  const all = (await res.json()) as GhRelease[]
  return all.filter(
    (r) =>
      !r.draft &&
      !r.prerelease &&
      typeof r.tag_name === 'string' &&
      (r.tag_name.startsWith(TAG_PREFIX) || r.tag_name === 'android-latest')
  )
}

function pickBestRelease(releases: GhRelease[]): GhRelease | null {
  const versioned = releases
    .filter((r) => r.tag_name && parseSemver(r.tag_name))
    .sort((a, b) => compareSemverDesc(a.tag_name!, b.tag_name!))
  if (versioned[0]) return versioned[0]
  return releases.find((r) => r.tag_name === 'android-latest') || null
}

function pickAsset(release: GhRelease, versionName: string | null) {
  const assets = release.assets || []
  const preferredNames = [
    versionName ? `pelbu-lms-${versionName}.apk` : null,
    assetName(),
    'pelbu-lms.apk',
  ].filter(Boolean) as string[]
  for (const name of preferredNames) {
    const hit = assets.find((a) => a.name === name)
    if (hit) return hit
  }
  return assets.find((a) => a.name.endsWith('.apk')) || null
}

export async function getAndroidRelease(): Promise<AndroidRelease> {
  const downloadPath = '/api/android/apk'
  const override = process.env.ANDROID_APK_URL
  if (override) {
    return {
      available: true,
      version: process.env.ANDROID_APK_VERSION || null,
      versionCode: process.env.ANDROID_APK_VERSION_CODE
        ? Number(process.env.ANDROID_APK_VERSION_CODE)
        : null,
      tag: null,
      publishedAt: null,
      sizeBytes: null,
      downloadPath,
      sourceUrl: override,
      filename: assetName(),
    }
  }

  try {
    const releases = await listAndroidReleases()
    const release = pickBestRelease(releases)
    if (!release) {
      return {
        available: false,
        version: null,
        versionCode: null,
        tag: null,
        publishedAt: null,
        sizeBytes: null,
        downloadPath,
        sourceUrl: null,
        filename: null,
        message:
          'The Android APK has not been published yet. Run Build Android APK (GitHub Actions) to cut a versioned release.',
      }
    }

    const tagName = release.tag_name || null
    const semver = tagName ? parseSemver(tagName) : null
    const versionName = semver
      ? `${semver[0]}.${semver[1]}.${semver[2]}`
      : (release.name || tagName || '').replace(/^Android\s+/i, '').trim() || null
    const asset = pickAsset(release, versionName)
    if (!asset) {
      return {
        available: false,
        version: versionName,
        versionCode: versionCodeFromNotes(release.body),
        tag: tagName,
        publishedAt: release.published_at || null,
        sizeBytes: null,
        downloadPath,
        sourceUrl: null,
        filename: null,
        message: 'The latest Android release does not include an APK yet.',
      }
    }

    return {
      available: true,
      version: versionName,
      versionCode: versionCodeFromNotes(release.body),
      tag: tagName,
      publishedAt: release.published_at || null,
      sizeBytes: asset.size,
      downloadPath,
      sourceUrl: asset.browser_download_url,
      filename: asset.name,
    }
  } catch {
    return {
      available: false,
      version: null,
      versionCode: null,
      tag: null,
      publishedAt: null,
      sizeBytes: null,
      downloadPath,
      sourceUrl: null,
      filename: null,
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
  const contentType = 'application/vnd.android.package-archive'
  const override = process.env.ANDROID_APK_URL
  const headers: Record<string, string> = {
    Accept: 'application/octet-stream',
    'User-Agent': 'pelbu-lms-android-download',
  }
  const token = process.env.ANDROID_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  if (token && !override) headers.Authorization = `Bearer ${token}`

  try {
    if (override) {
      const res = await fetch(override, { headers, cache: 'no-store', redirect: 'follow' })
      if (!res.ok) {
        return {
          ok: false,
          status: res.status === 404 ? 404 : 502,
          body: null,
          filename: assetName(),
          contentType,
          error: 'Failed to download the Android APK.',
        }
      }
      return {
        ok: true,
        status: 200,
        body: await res.arrayBuffer(),
        filename: assetName(),
        contentType,
      }
    }

    const meta = await getAndroidRelease()
    if (!meta.available || !meta.sourceUrl) {
      return {
        ok: false,
        status: 404,
        body: null,
        filename: meta.filename || assetName(),
        contentType,
        error: meta.message || 'Android APK is not published yet.',
      }
    }

    const filename = meta.filename || assetName()

    // Prefer GitHub asset API URL when authenticated (works for private assets too).
    if (token && meta.tag) {
      const releaseRes = await fetch(
        `https://api.github.com/repos/${repo()}/releases/tags/${meta.tag}`,
        { headers: githubHeaders(), cache: 'no-store' }
      )
      if (releaseRes.ok) {
        const body = (await releaseRes.json()) as GhRelease
        const asset =
          body.assets?.find((a) => a.name === filename) ||
          body.assets?.find((a) => a.name.endsWith('.apk'))
        if (asset?.url) {
          const assetRes = await fetch(asset.url, {
            headers: { ...headers, Accept: 'application/octet-stream' },
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

    const res = await fetch(meta.sourceUrl, { headers, cache: 'no-store', redirect: 'follow' })
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
      filename: assetName(),
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
