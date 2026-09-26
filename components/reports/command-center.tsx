'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FunnelChart,
  InstitutionScoreChart,
  SparkKpis,
  TrendChart,
} from '@/components/reports/infographics/charts'
import { AiBriefingPanel } from '@/components/reports/ai-briefing-panel'
import { ExportPackBar } from '@/components/reports/export-pack-bar'
import { ReportBlockCard, ReportHubHeader, ReportSectionTabs } from '@/components/reports/report-ui'
import type { ReportRange, ReportSnapshot } from '@/lib/reports/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

export function CommandCenter({
  snapshot,
  range,
  onRangeChange,
  role,
  showDeepDive,
  deepDiveSection,
  onDeepDiveChange,
}: {
  snapshot: ReportSnapshot
  range: ReportRange
  onRangeChange: (r: ReportRange) => void
  role: string
  showDeepDive?: boolean
  deepDiveSection?: string
  onDeepDiveChange?: (id: string) => void
}) {
  const ranges: ReportRange[] = ['7d', '30d', '90d']
  const currentSection =
    snapshot.sections.find((s) => s.section === deepDiveSection) || snapshot.sections[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <ReportHubHeader
          title="Executive Command Center"
          description="Decision-first view of adoption, KYC SLA, catalog risk, and institution health — with Claude briefings and board-ready exports."
          badges={[role === 'superadmin' ? 'Superadmin' : 'Admin', range]}
        />
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex gap-1 rounded-full border border-border/60 p-1">
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm transition-colors',
                  range === r
                    ? 'bg-bhutan-yellow/25 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60'
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <ExportPackBar range={range} includeAiBrief />
        </div>
      </div>

      <SparkKpis kpis={snapshot.kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart steps={snapshot.funnel} />
        <TrendChart series={snapshot.series} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InstitutionScoreChart rows={snapshot.institutionScores} />

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Action queue</CardTitle>
            <CardDescription>Deterministic priorities from live thresholds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.actions.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/50 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="mr-2 text-bhutan-orange">{a.priority}.</span>
                    {a.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{a.reason}</p>
                </div>
                <Link
                  href={a.href}
                  className="inline-flex shrink-0 items-center text-sm text-bhutan-orange hover:underline"
                >
                  Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                No alerts in this window.
              </div>
            ) : (
              snapshot.alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex gap-2 rounded-lg border border-border/50 bg-muted/20 p-3"
                >
                  <AlertTriangle
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      a.severity === 'critical'
                        ? 'text-red-600'
                        : a.severity === 'watch'
                          ? 'text-amber-600'
                          : 'text-muted-foreground'
                    )}
                  />
                  <div className="min-w-0">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{a.severity}</Badge>
                      <span className="font-medium">{a.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                    {a.href ? (
                      <Link href={a.href} className="mt-1 inline-block text-xs text-bhutan-orange">
                        View →
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Catalog & audience risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.tables
              .filter((t) => t.key === 'dark-catalog' || t.key === 'audience-misfit')
              .map((t) => (
                <div key={t.key}>
                  <p className="mb-2 text-sm font-medium">
                    {t.title}{' '}
                    <span className="text-muted-foreground">({t.rows.length})</span>
                  </p>
                  {t.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {t.rows.slice(0, 5).map((r) => (
                        <li key={r.id} className="truncate">
                          {r.href ? (
                            <Link href={r.href} className="text-bhutan-orange hover:underline">
                              {String(r.cells.course || r.cells.name || r.id)}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              {String(r.cells.course || r.cells.name || r.id)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <AiBriefingPanel range={range} />

      {showDeepDive && snapshot.sections.length > 0 && onDeepDiveChange ? (
        <div className="space-y-4 border-t border-border/40 pt-6">
          <h2 className="text-xl font-semibold">Deep dive</h2>
          <ReportSectionTabs
            sections={snapshot.sections.map((s) => ({ id: s.section, title: s.title }))}
            active={currentSection?.section || ''}
            onChange={onDeepDiveChange}
          />
          <div className="space-y-4">
            {(currentSection?.blocks || []).map((block) => (
              <ReportBlockCard key={block.id} block={block} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
