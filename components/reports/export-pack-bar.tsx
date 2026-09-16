'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import type { ReportRange, SnapshotAudience } from '@/lib/reports/types'
import { toast } from 'sonner'

export function ExportPackBar({
  range,
  includeAiBrief = true,
  audience,
}: {
  range: ReportRange
  includeAiBrief?: boolean
  audience?: SnapshotAudience
}) {
  const [busy, setBusy] = useState<string | null>(null)

  const download = async (format: 'pdf' | 'docx' | 'xlsx') => {
    try {
      setBusy(format)
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          range,
          includeAiBrief: includeAiBrief && audience !== 'student',
          audience,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Export failed')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      const filename = match?.[1] || `pelbu-report.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${filename}`)
    } catch (e: any) {
      toast.error(e.message || 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Export pack:</span>
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => download('pdf')}>
        {busy === 'pdf' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        PDF
      </Button>
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => download('docx')}>
        {busy === 'docx' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        DOCX
      </Button>
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => download('xlsx')}>
        {busy === 'xlsx' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        Excel
      </Button>
    </div>
  )
}
