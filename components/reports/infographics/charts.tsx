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
import type {
  FrictionHotspot,
  FrictionType,
  FunnelStep,
  InstitutionScoreRow,
  ReportSeries,
} from '@/lib/reports/types'
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

export function FunnelChart({
  steps,
  title = 'Growth funnel',
  description,
}: {
  steps: FunnelStep[]
  title?: string
  description?: string
}) {
  const data = steps.map((s) => ({ name: s.label, count: s.count }))
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
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

export function FrictionHotspotChart({ hotspots }: { hotspots: FrictionHotspot[] }) {
  const data = hotspots.slice(0, 10).map((h) => ({
    name: h.lessonTitle.length > 22 ? `${h.lessonTitle.slice(0, 20)}…` : h.lessonTitle,
    score: h.frictionScore,
    type: h.frictionType,
  }))

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Friction hotspots</CardTitle>
        <CardDescription>Top lessons by composite friction score</CardDescription>
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

export function TrendChart({ series }: { series: ReportSeries[] }) {
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
      <CardHeader>
        <CardTitle className="text-base">Weekly trends</CardTitle>
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

export function InstitutionScoreChart({ rows }: { rows: InstitutionScoreRow[] }) {
  const data = rows.slice(0, 12).map((r) => ({
    name: r.name.length > 18 ? `${r.name.slice(0, 16)}…` : r.name,
    score: r.compositeScore,
  }))
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Institution scoreboard</CardTitle>
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
}: {
  kpis: { key: string; label: string; value: string | number; hint?: string }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.key}
          className="rounded-xl border border-bhutan-orange/20 bg-gradient-to-br from-bhutan-yellow/15 to-transparent p-4"
        >
          <p className="text-xs text-muted-foreground">{k.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-bhutan-orange">
            {k.value}
          </p>
          {k.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{k.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}

export { AMBER }
