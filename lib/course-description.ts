import { sanitizeHtml } from '@/lib/lesson-blocks'

/** Shared list and paragraph spacing for the editor and the public description. */
export const courseDescriptionRichClass =
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2'

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value)
}

function tagCount(value: string) {
  return (value.match(/<\/?[a-z][^>]*>/gi) || []).length
}

function decodeEntities(value: string) {
  let current = value
  for (let pass = 0; pass < 3; pass++) {
    const next = current
      .replace(/&amp;/gi, '&')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
    if (next === current) break
    current = next
  }
  return current
}

/**
 * Pasted Google Docs HTML is often stored as escaped source (`&lt;span...`).
 * When the visible text is itself a document, use that document.
 */
function unwrapEscapedMarkup(value: string) {
  let current = value.trim()
  for (let pass = 0; pass < 3; pass++) {
    const text = current.replace(/<[^>]+>/g, '')
    let decoded = text
    for (let i = 0; i < 3; i++) {
      const next = decodeEntities(decoded)
      if (next === decoded) break
      decoded = next
    }
    const markup = decoded.trim()
    const pastedDocument = /^</.test(markup) || /docs-internal-guid/i.test(markup)
    if (!pastedDocument || !looksLikeHtml(markup) || tagCount(markup) < 2) break
    if (markup === current) break
    current = markup
  }
  return current
}

/** Drop Google Docs presentation so a description reads as headings, lists, and paragraphs. */
function cleanDescriptionHtml(html: string) {
  return sanitizeHtml(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:html|head|body|meta|link|title|o:p)[^>]*>/gi, '')
    .replace(/\s(?:style|class|id|dir|role|lang|aria-[\w-]+)="[^"]*"/gi, '')
    .replace(/\s(?:style|class|id|dir|role|lang|aria-[\w-]+)='[^']*'/gi, '')
    .replace(/<span\b[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<font\b[^>]*>/gi, '')
    .replace(/<\/font>/gi, '')
    .replace(/<b\b[^>]*>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i\b[^>]*>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>')
    .replace(/<(p|div|h[1-6]|li)(\s[^>]*)?>\s*<\/\1>/gi, '')
    .trim()
}

/** HTML safe to render for a course, module, or lesson description. */
export function courseDescriptionHtml(value: string | null | undefined) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const unwrapped = unwrapEscapedMarkup(trimmed)
  if (looksLikeHtml(unwrapped)) return cleanDescriptionHtml(unwrapped)
  const decoded = decodeEntities(unwrapped)
  if (looksLikeHtml(decoded)) return cleanDescriptionHtml(decoded)
  const escaped = decoded
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p class="whitespace-pre-wrap">${paragraph.replace(/\n/g, '<br>')}</p>`
    )
    .join('')
}

/** Plain descriptions stay readable in the editor. Formatted ones stay as sanitized HTML. */
export function courseDescriptionEditorHtml(value: string) {
  return courseDescriptionHtml(value) || '<p></p>'
}

export function courseDescriptionPlain(value: string | null | undefined) {
  return courseDescriptionHtml(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
