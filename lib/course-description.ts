import { sanitizeHtml } from '@/lib/lesson-blocks'

/** Shared list and paragraph spacing for the editor and the public description. */
export const courseDescriptionRichClass =
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2'

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value)
}

/** Plain descriptions stay readable in the editor. Formatted ones stay as sanitized HTML. */
export function courseDescriptionEditorHtml(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return '<p></p>'
  if (looksLikeHtml(trimmed)) return sanitizeHtml(trimmed)
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function courseDescriptionPlain(value: string | null | undefined) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
