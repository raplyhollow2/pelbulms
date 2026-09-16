'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { RoleReportDashboard } from '@/components/reports/role-report-dashboard'
import type { ReportRange, ReportSnapshot } from '@/lib/reports/types'

export default function LearnReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<ReportRange>('30d')
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null)
  const [deepDive, setDeepDive] = useState('my-learning')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/reports/snapshot?range=${range}&audience=student`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load reports')
      setSnapshot(json.snapshot)
      if (json.snapshot?.sections?.[0]?.section) {
        setDeepDive(json.snapshot.sections[0].section)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="container mx-auto flex items-center gap-2 px-4 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading reports…
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="container mx-auto px-4 py-8 text-muted-foreground">No report data.</div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <RoleReportDashboard
        snapshot={snapshot}
        range={range}
        onRangeChange={setRange}
        badge="Student"
        showDeepDive
        deepDiveSection={deepDive}
        onDeepDiveChange={setDeepDive}
        headerExtra={
          <Link
            href="/learn/progress"
            className="inline-flex h-8 items-center rounded-md border border-border/60 px-3 text-sm text-muted-foreground hover:bg-muted/60"
          >
            Classic progress view
          </Link>
        }
      />
    </div>
  )
}
