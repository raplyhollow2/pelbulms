'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download } from 'lucide-react'
import { downloadCsv, rowsToCsv } from '@/lib/reports/csv'
import type { ReportBlock } from '@/lib/reports/types'
import { cn } from '@/lib/utils'

export function ReportMetrics({ block }: { block: ReportBlock }) {
  if (!block.metrics?.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {block.metrics.map((m) => (
        <div key={m.key} className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{m.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-bhutan-orange">{m.value}</p>
          {m.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{m.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}

export function ReportTable({ block }: { block: ReportBlock }) {
  if (!block.columns?.length) return null
  const rows = block.rows || []
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">{block.emptyMessage || 'No rows.'}</p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {block.columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border/40">
              {block.columns!.map((c) => (
                <td key={c.key} className="px-3 py-2 align-top">
                  {row.cells[c.key] == null ? '—' : String(row.cells[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportBlockCard({
  block,
  highlight,
  withAnchor = true,
}: {
  block: ReportBlock
  highlight?: boolean
  /** When false, parent owns the scroll anchor id. */
  withAnchor?: boolean
}) {
  const canExport = !!(block.columns?.length && block.rows?.length)

  return (
    <Card
      id={withAnchor ? `report-block-${block.id}` : undefined}
      className={cn(
        'glass scroll-mt-24',
        highlight && 'ring-2 ring-bhutan-orange/50'
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-lg">{block.title}</CardTitle>
          {block.description ? (
            <CardDescription className="mt-1">{block.description}</CardDescription>
          ) : null}
        </div>
        {canExport ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const csv = rowsToCsv(block.columns!, block.rows!)
              downloadCsv(`pelbu-${block.id}`, csv)
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <ReportMetrics block={block} />
        <ReportTable block={block} />
        {!block.metrics?.length && !block.columns?.length && block.emptyMessage ? (
          <p className="text-sm text-muted-foreground">{block.emptyMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ReportSectionTabs({
  sections,
  active,
  onChange,
}: {
  sections: { id: string; title: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm transition-colors',
            active === s.id
              ? 'border-bhutan-orange/40 bg-bhutan-yellow/20 text-foreground'
              : 'border-border/60 text-muted-foreground hover:bg-muted/60'
          )}
        >
          {s.title}
        </button>
      ))}
    </div>
  )
}

export function ReportHubHeader({
  title,
  description,
  badges,
}: {
  title: string
  description: string
  badges?: string[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {badges?.map((b) => (
          <Badge key={b} variant="outline">
            {b}
          </Badge>
        ))}
      </div>
      <p className="max-w-2xl text-muted-foreground">{description}</p>
    </div>
  )
}
