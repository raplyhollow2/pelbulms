'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FrictionHotspotChart,
  FunnelChart,
  InstitutionScoreChart,
  SparkKpis,
  TrendChart,
} from '@/components/reports/infographics/charts'
import { AiBriefingPanel } from '@/components/reports/ai-briefing-panel'
import { ExportPackBar } from '@/components/reports/export-pack-bar'
import { FrictionMapPanel } from '@/components/reports/friction-map-panel'
import { ReportBlockCard, ReportHubHeader, ReportSectionTabs } from '@/components/reports/report-ui'
import {
  audienceAllowsAiBrief,
  type ReportRange,
  type ReportSnapshot,
  type SnapshotAudience,
} from '@/lib/reports/types'
import { LiveUsersPanel } from '@/components/admin/live-users-panel'
import type { ModelFamily } from '@/lib/ai/models'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

const DESCRIPTIONS: Record<SnapshotAudience, string> = {
  superadmin:
    'Decision-first view of adoption, KYC SLA, catalog risk, and institution health — with Claude briefings and board-ready exports.',
  admin:
    'Adoption, funnel, and catalog health for platform admins — with export packs and AI briefing.',
  instructor:
    'Engagement, at-risk learners, lesson friction, and outcomes for courses you teach — with exports and AI coaching.',
  resource_person:
    'KYC queue health, SLA, and institution coverage — with exports and AI recommendations.',
  student:
    'Your progress, assessments, and certificates — with printable PDF / DOCX / Excel packs.',
}

export function RoleReportDashboard({
  snapshot,
  range,
  onRangeChange,
  badge,
  showDeepDive = true,
  deepDiveSection,
  onDeepDiveChange,
  headerExtra,
  focusBlockId,
}: {
  snapshot: ReportSnapshot
  range: ReportRange
  onRangeChange: (r: ReportRange) => void
  badge?: string
  showDeepDive?: boolean
  deepDiveSection?: string
  onDeepDiveChange?: (id: string) => void
  headerExtra?: React.ReactNode
  /** Scroll/highlight a detailed-report block (e.g. lesson-friction). */
  focusBlockId?: string | null
}) {
  const audience = snapshot.audience
  const showAi = audienceAllowsAiBrief(audience)
  const [family, setFamily] = useState<ModelFamily>('claude')
  const familyTouched = useRef(false)
  const [focus, setFocus] = useState<{ label: string; detail?: string } | null>(null)

  useEffect(() => {
    if (!showAi) return
    let cancelled = false
    void fetch('/api/ai/models')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && !familyTouched.current && json.defaults?.report) {
          setFamily(json.defaults.report)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [showAi])

  const explain = (label: string, detail?: string) => {
    setFocus({ label, detail })
    window.setTimeout(() => {
      document.getElementById('report-interpreter')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
  }
  const showInstitutionChart = snapshot.institutionScores.length > 0
  const frictionMap = snapshot.frictionMap
  const showFrictionCharts =
    audience === 'instructor' && !!frictionMap && frictionMap.hotspots.length > 0
  const ranges: ReportRange[] = ['7d', '30d', '90d']
  const currentSection =
    snapshot.sections.find((s) => s.section === deepDiveSection) || snapshot.sections[0]

  useEffect(() => {
    if (!focusBlockId || !showDeepDive) return
    const timer = window.setTimeout(() => {
      document
        .getElementById(`report-block-${focusBlockId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusBlockId, deepDiveSection, showDeepDive, snapshot.hash])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <ReportHubHeader
          title={snapshot.title}
          description={DESCRIPTIONS[audience]}
          badges={[badge || audience, range]}
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
          <ExportPackBar
            range={range}
            audience={audience}
            includeAiBrief={showAi}
            family={family}
          />
          {headerExtra}
        </div>
      </div>

      {(audience === 'superadmin' || audience === 'admin') && <LiveUsersPanel />}

      <SparkKpis
        kpis={snapshot.kpis}
        onExplain={
          showAi
            ? (kpi) => explain(kpi.label, kpi.hint || String(kpi.value))
            : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelChart
          steps={snapshot.funnel}
          onExplain={showAi ? () => explain('Growth funnel') : undefined}
        />
        <TrendChart
          series={snapshot.series}
          onExplain={showAi ? () => explain('Weekly trends') : undefined}
        />
      </div>

      {snapshot.breakdowns && snapshot.breakdowns.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">Learner profile</h2>
            <p className="text-sm text-muted-foreground">
              Each person is counted once. Open Learner profile in detailed reports for class, gewog,
              and completeness.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {snapshot.breakdowns.map((breakdown) => (
              <FunnelChart
                key={breakdown.key}
                steps={breakdown.steps}
                title={breakdown.title}
                description={breakdown.description}
                onExplain={
                  showAi ? () => explain(breakdown.title, breakdown.description) : undefined
                }
                yAxisWidth={
                  breakdown.key === 'learner-dzongkhag' || breakdown.key === 'learner-qualification'
                    ? 148
                    : 110
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {showFrictionCharts && frictionMap ? (
        <div
          className={cn(
            'grid gap-4',
            frictionMap.sequenceFunnel.length > 0 ? 'lg:grid-cols-2' : ''
          )}
        >
          <FrictionHotspotChart
            hotspots={frictionMap.hotspots}
            onExplain={showAi ? () => explain('Friction hotspots') : undefined}
          />
          {frictionMap.sequenceFunnel.length > 0 ? (
            <FunnelChart
              steps={frictionMap.sequenceFunnel}
              title="Lesson sequence starts"
              onExplain={showAi ? () => explain('Lesson sequence starts') : undefined}
              description={
                frictionMap.sequenceCourseTitle
                  ? `Start counts along ${frictionMap.sequenceCourseTitle}`
                  : 'Start counts along the highest-friction course path'
              }
            />
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-4',
          showInstitutionChart || showFrictionCharts ? 'lg:grid-cols-2' : ''
        )}
      >
        {showInstitutionChart ? (
          <InstitutionScoreChart
            rows={snapshot.institutionScores}
            onExplain={showAi ? () => explain('Institution scoreboard') : undefined}
          />
        ) : null}

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Action queue</CardTitle>
            <CardDescription>Priorities from live thresholds</CardDescription>
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
                    <Link
                      href={a.href}
                      className="mt-1 inline-block text-xs text-bhutan-orange hover:underline"
                    >
                      Open →
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {showAi ? (
        <AiBriefingPanel
          range={range}
          audience={audience}
          family={family}
          onFamilyChange={(next) => {
            familyTouched.current = true
            setFamily(next)
          }}
          focus={focus}
        />
      ) : null}

      {showDeepDive && snapshot.sections.length > 0 && onDeepDiveChange ? (
        <div className="space-y-4 border-t border-border/40 pt-6">
          <h2 className="text-xl font-semibold">Detailed reports</h2>
          <ReportSectionTabs
            sections={snapshot.sections.map((s) => ({ id: s.section, title: s.title }))}
            active={currentSection?.section || ''}
            onChange={onDeepDiveChange}
          />
          <div className="space-y-4">
            {(currentSection?.blocks || []).map((block) => {
              const showFrictionGuide =
                block.id === 'lesson-friction' && !!frictionMap
              return (
                <div
                  key={block.id}
                  id={showFrictionGuide ? `report-block-${block.id}` : undefined}
                  className={cn(showFrictionGuide && 'scroll-mt-24 space-y-4')}
                >
                  {showFrictionGuide ? (
                    <FrictionMapPanel frictionMap={frictionMap!} />
                  ) : null}
                  <ReportBlockCard
                    block={block}
                    highlight={focusBlockId === block.id}
                    withAnchor={!showFrictionGuide}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
