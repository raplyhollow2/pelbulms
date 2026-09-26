'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Link from 'next/link'
import type {
  FrictionHotspot,
  FrictionType,
  FunnelStep,
  InstitutionScoreRow,
  ReportMetric,
  ReportSeries,
} from '@/lib/reports/types'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const ORANGE = '#ea580c'
const AMBER = '#f59e0b'
const COLORS = ['#ea580c', '#f59e0b', '#fb923c', '#fdba74', '#c2410c']

const FRICTION_TYPE_COLORS: Record<FrictionType, string> = {
  drop_off: '#ea580c',
  hesitation: '#d97706',
  stuck: '#b45309',
  assessment: '#c2410c',
}

function ExplainButton({ onExplain }: { onExplain?: () => void }) {
  if (!onExplain) return null
  return (
    <button
      type="button"
      onClick={onExplain}
      className="shrink-0 text-xs font-medium text-bhutan-orange hover:underline"
    >
      Explain
    </button>
  )
}

export function FunnelChart({
  steps,
  title = 'Growth funnel',
  description,
  yAxisWidth = 110,
  onExplain,
}: {
  steps: FunnelStep[]
  title?: string
  description?: string
  yAxisWidth?: number
  onExplain?: () => void
}) {
  const data = steps.map((s) => ({ name: s.label, count: s.count }))
  const height = steps.length > 8 ? Math.max(256, steps.length * 28) : 256
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <ExplainButton onExplain={onExplain} />
      </CardHeader>
      <CardContent style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={yAxisWidth} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function FrictionHotspotChart({
  hotspots,
  onExplain,
}: {
  hotspots: FrictionHotspot[]
  onExplain?: () => void
}) {
  const data = hotspots.slice(0, 10).map((h) => ({
    name: h.lessonTitle.length > 22 ? `${h.lessonTitle.slice(0, 20)}…` : h.lessonTitle,
    score: h.frictionScore,
    type: h.frictionType,
  }))

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Friction hotspots</CardTitle>
          <CardDescription>Top lessons by composite friction score</CardDescription>
        </div>
        <ExplainButton onExplain={onExplain} />
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friction hotspots in this window.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: number, _name, item) => [
                  `${value} (${(item?.payload as { type?: string })?.type || '—'})`,
                  'Score',
                ]}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={FRICTION_TYPE_COLORS[d.type as FrictionType] || ORANGE}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function TrendChart({
  series,
  onExplain,
}: {
  series: ReportSeries[]
  onExplain?: () => void
}) {
  const dates = series[0]?.points.map((p) => p.date) || []
  const data = dates.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5) }
    for (const s of series) {
      row[s.key] = s.points.find((p) => p.date === date)?.value ?? 0
    }
    return row
  })

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Weekly trends</CardTitle>
        <ExplainButton onExplain={onExplain} />
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function InstitutionScoreChart({
  rows,
  onExplain,
}: {
  rows: InstitutionScoreRow[]
  onExplain?: () => void
}) {
  const data = rows.slice(0, 12).map((r) => ({
    name: r.name.length > 18 ? `${r.name.slice(0, 16)}…` : r.name,
    score: r.compositeScore,
  }))
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Institution scoreboard</CardTitle>
        <ExplainButton onExplain={onExplain} />
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="score" fill={ORANGE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function SparkKpis({
  kpis,
  onExplain,
}: {
  kpis: ReportMetric[]
  onExplain?: (kpi: ReportMetric) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {kpis.map((k) => {
        const className = cn(
          'rounded-xl border border-bhutan-orange/20 bg-gradient-to-br from-bhutan-yellow/15 to-transparent p-4',
          k.href && 'transition-colors hover:border-bhutan-orange/50'
        )
        const figures = (
          <>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-bhutan-orange">{k.value}</p>
            {k.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{k.hint}</p> : null}
          </>
        )
        return (
          <div key={k.key} className={className}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              {onExplain ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-bhutan-orange hover:underline"
                  onClick={() => onExplain(k)}
                >
                  Explain
                </button>
              ) : null}
            </div>
            {k.href ? (
              <Link href={k.href} className="block">
                {figures}
              </Link>
            ) : (
              figures
            )}
          </div>
        )
      })}
    </div>
  )
}

export { AMBER }
