/** Client-side CSV helpers for report exports. */

export function rowsToCsv(
  columns: { key: string; label: string }[],
  rows: { cells: Record<string, string | number | boolean | null> }[]
): string {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escape(row.cells[c.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
