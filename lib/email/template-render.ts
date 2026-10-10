const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'a',
  'img',
])

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function templateTokens(body: string): string[] {
  const found = new Set<string>()
  for (const match of body.matchAll(TOKEN_RE)) {
    if (match[1]) found.add(match[1].toLowerCase())
  }
  return [...found]
}

export function unknownTemplateTokens(body: string, allowed: string[]): string[] {
  const allow = new Set(allowed.map((token) => token.toLowerCase()))
  return templateTokens(body).filter((token) => !allow.has(token))
}

/** Drop scripts, event handlers, and non-http(s) URLs from admin-authored HTML. */
export function sanitizeEmailHtml(html: string): string {
  let next = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(iframe|object|embed|link|meta|form|input|button)[^>]*>/gi, '')
  next = next.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  next = next.replace(/\s(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (full, attr, _quoted, double, single, bare) => {
    const value = String(double ?? single ?? bare ?? '').trim()
    const lower = value.toLowerCase()
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
      return ''
    }
    if (attr.toLowerCase() === 'src' && !/^https:\/\//i.test(value)) return ''
    if (attr.toLowerCase() === 'href' && !/^(https?:\/\/|mailto:|\{\{)/i.test(value) && !value.startsWith('/')) {
      return ''
    }
    return full
  })
  next = next.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag) => {
    if (!ALLOWED_TAGS.has(String(tag).toLowerCase())) return ''
    return full
  })
  return next
}

export function renderTemplate(body: string, vars: Record<string, string>, html: boolean): string {
  return body.replace(TOKEN_RE, (_match, key: string) => {
    const value = vars[key.toLowerCase()] ?? vars[key] ?? ''
    return html ? escapeHtml(value) : value
  })
}

export function safeActionUrl(path: string, origin: string): string {
  const trimmed = path.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return origin
  }
  return `${origin}${trimmed}`
}

const EMAIL_LOGO = 'https://www.rigbu.app/email-logo-400.png'
const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

function emailButton(href: string, label: string) {
  const text = label.trim() || 'Open'
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td bgcolor="#1B2433" style="border-radius:999px;background:#1B2433"><a href="${href}" style="display:inline-block;padding:13px 22px;font-family:${EMAIL_FONT};font-size:15px;font-weight:600;line-height:1;color:#FAF7F2;text-decoration:none;border-radius:999px">${text}</a></td></tr></table>`
}

/** Turn a standalone “Start learning” link into a button, and wrap the message in the Rigbu card. */
export function layoutEmailHtml(html: string | undefined, text: string): string {
  let body = html?.trim()
    ? html
    : `<p>${escapeHtml(text).replace(/\n/g, '<br />')}</p>`

  body = body.replace(/<p>\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<\/p>/gi, (full, attrs: string, inner: string) => {
    const hrefMatch = String(attrs).match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i)
    const href = hrefMatch ? hrefMatch[2] || hrefMatch[3] || '' : ''
    if (!href) return full
    const label = inner.replace(/<[^>]+>/g, '')
    return emailButton(href, label)
  })

  body = body.replace(/<p(\s[^>]*)?>/gi, (full) => {
    if (/style\s*=/i.test(full)) return full
    return full.replace(/<p/i, '<p style="margin:0 0 14px"')
  })

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAF7F2"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E8E2D8;border-radius:20px"><tr><td style="height:6px;background:#F5B82E;border-radius:20px 20px 0 0;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:28px 32px 8px"><img src="${EMAIL_LOGO}" width="168" alt="Rigbu" style="display:block;border:0;width:168px;height:auto" /></td></tr><tr><td style="padding:8px 32px 32px;font-family:${EMAIL_FONT};font-size:16px;line-height:1.6;color:#1B2433">${body}</td></tr></table><p style="margin:16px 0 0;font-family:${EMAIL_FONT};font-size:12px;line-height:1.4;color:#8A8175">Rigbu · Learn anywhere</p></td></tr></table></body></html>`
}
