/** Client-side CSV helpers for report exports. */

export function rowsToCsv(
  columns: { key: string; label: string }[],
  rows: { cells: Record<string, string | number | boolean | null>; href?: string }[]
): string {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const withLinks = rows.some((row) => row.href)
  const header = [...columns.map((c) => escape(c.label)), ...(withLinks ? ['Link'] : [])].join(',')
  const body = rows
    .map((row) =>
      [
        ...columns.map((c) => escape(row.cells[c.key])),
        ...(withLinks ? [escape(row.href || '')] : []),
      ].join(',')
    )
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
