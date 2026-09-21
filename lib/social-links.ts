export type SocialLinks = {
  linkedin?: string
  github?: string
  website?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Accept a full LinkedIn URL or a profile slug such as `in/jane-doe`. */
export function normalizeLinkedInUrl(raw?: string | null): string | null {
  const value = (raw || '').trim()
  if (!value) return null

  let candidate = value
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^(www\.|[a-z]{2}\.)?linkedin\.com\b/i.test(candidate)) {
      candidate = `https://${candidate}`
    } else if (/^\/?(in|pub|company)\//i.test(candidate)) {
      candidate = `https://www.linkedin.com/${candidate.replace(/^\//, '')}`
    } else if (/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,99}$/.test(candidate)) {
      candidate = `https://www.linkedin.com/in/${candidate}`
    } else {
      return null
    }
  }

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null
    parsed.protocol = 'https:'
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

export function parseSocialLinks(value: unknown): SocialLinks {
  if (!isPlainObject(value)) return {}
  const linkedin = normalizeLinkedInUrl(asNonEmptyString(value.linkedin)) || undefined
  const github = asNonEmptyString(value.github)
  const website = asNonEmptyString(value.website)
  return {
    ...(linkedin ? { linkedin } : {}),
    ...(github ? { github } : {}),
    ...(website ? { website } : {}),
  }
}

export function linkedinFromProfile(profile: {
  social_links?: unknown
  metadata?: unknown
} | null | undefined): string | null {
  if (!profile) return null
  const fromColumn = parseSocialLinks(profile.social_links).linkedin
  if (fromColumn) return fromColumn
  const meta = isPlainObject(profile.metadata) ? profile.metadata : null
  return parseSocialLinks(meta?.social_links).linkedin || null
}

export function mergeSocialLinks(
  existing: unknown,
  patch: Partial<SocialLinks>
): SocialLinks {
  const next = { ...parseSocialLinks(existing) }
  if ('linkedin' in patch) {
    const linkedin = normalizeLinkedInUrl(patch.linkedin)
    if (linkedin) next.linkedin = linkedin
    else delete next.linkedin
  }
  if ('github' in patch) {
    const github = asNonEmptyString(patch.github)
    if (github) next.github = github
    else delete next.github
  }
  if ('website' in patch) {
    const website = asNonEmptyString(patch.website)
    if (website) next.website = website
    else delete next.website
  }
  return next
}
