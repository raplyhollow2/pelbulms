/** List position, starting at 1. Titles that already start with a module number stay as written. */
export function moduleDisplayTitle(index: number, title: string): string {
  const trimmed = title.trim()
  if (/^module\s+\d+\b/i.test(trimmed)) return trimmed
  const name = /^module$/i.test(trimmed) ? '' : trimmed
  return name ? `Module ${index + 1}: ${name}` : `Module ${index + 1}`
}
