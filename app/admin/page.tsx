'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Award,
  BookOpen,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  LogIn,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import { SuperadminGate } from '@/components/admin/superadmin-gate'
import { CAP } from '@/lib/capability-keys'
import { LiveUsersPanel } from '@/components/admin/live-users-panel'
import { Button } from '@/components/ui/button'
import type { PlatformStats } from '@/lib/admin/platform-stats'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  student: 'Students',
  instructor: 'Instructors',
  resource_person: 'Resource persons',
  admin: 'Admins',
  superadmin: 'Superadmins',
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon: typeof Users
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bhutan-yellow/15 text-bhutan-orange">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  )
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const width = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-bhutan-yellow to-bhutan-orange"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export default function AdminOverviewPage() {
  return (
    <SuperadminGate anyOf={[CAP.DASHBOARD_VIEW]}>
      <AdminOverviewBody />
    </SuperadminGate>
  )
}

function freshnessLabel(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 3) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return new Date(iso).toLocaleString()
}

function AdminOverviewBody() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/admin/stats?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load stats')
      setStats(data.stats as PlatformStats)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load stats')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async (mode: 'initial' | 'refresh') => {
      if (cancelled) return
      await load(mode)
    }
    run('initial')
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') run('refresh')
    }, 15000)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [load])

  if (loading && !stats) {
    return (
      <div className="flex items-center gap-2 px-4 py-16 text-sm text-muted-foreground sm:px-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading LMS overview…
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <p className="text-sm text-destructive">{error || 'No stats available.'}</p>
      </div>
    )
  }

  const maxBucket = Math.max(1, ...stats.learning.progressBuckets.map((b) => b.count))
  const maxRole = Math.max(1, ...Object.values(stats.users.byRole))
  const activityHint =
    stats.users.activitySource === 'auth'
      ? 'From last sign-in'
      : 'From course last-accessed (sign-in data unavailable)'

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Superadmin
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">LMS overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live scale of the platform: people, learning progress, catalog, and operations.
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live from database · {freshnessLabel(stats.generatedAt, now)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load('refresh')}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/admin/reports" />}>
            Open detailed reports
          </Button>
        </div>
      </header>

      <LiveUsersPanel />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Users"
          value={stats.users.total}
          hint={`+${stats.users.new7d} this week · +${stats.users.new30d} this month`}
        />
        <StatCard
          icon={GraduationCap}
          label="Enrollments"
          value={stats.learning.enrollments}
          hint={`${stats.learning.completionRate}% completed · avg ${stats.learning.avgProgress}%`}
        />
        <StatCard
          icon={BookOpen}
          label="Published courses"
          value={stats.catalog.published}
          hint={`${stats.catalog.draft} drafts · ${stats.catalog.lessons} lessons`}
        />
        <StatCard
          icon={TrendingUp}
          label="Learners 7d"
          value={stats.learning.active7d}
          hint={`${stats.learning.active30d} in 30 days`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Award}
          label="Certificates"
          value={stats.catalog.certificates}
          hint={`${stats.catalog.quizAttempts} quiz attempts`}
        />
        <StatCard
          icon={Building2}
          label="Institutions"
          value={stats.operations.activeInstitutions}
          hint={`${stats.operations.institutions} total`}
        />
        <StatCard
          icon={ClipboardCheck}
          label="KYC pending"
          value={stats.operations.pendingRegistrations}
          hint={`${stats.operations.approvedRegistrations} approved · ${stats.operations.rejectedRegistrations} rejected`}
        />
        <StatCard
          icon={LogIn}
          label="Signed in 7d"
          value={stats.users.signedIn7d}
          hint={activityHint}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold">Users by role</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{activityHint}</p>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.users.byRole)
              .sort((a, b) => b[1] - a[1])
              .map(([role, count]) => (
                <BarRow
                  key={role}
                  label={ROLE_LABELS[role] || role}
                  count={count}
                  max={maxRole}
                />
              ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Signed in last 7 days: {stats.users.signedIn7d}. At-risk enrollments (stalled 14+
            days under 50%): {stats.learning.atRisk}.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold">Enrollment progress</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stats.learning.inProgress} in progress · {stats.learning.completed} completed
            </p>
          </div>
          <div className="space-y-3">
            {stats.learning.progressBuckets.map((b) => (
              <BarRow key={b.label} label={b.label} count={b.count} max={maxBucket} />
            ))}
          </div>
        </section>
      </div>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Catalog scale</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ['Courses', stats.catalog.courses],
            ['Modules', stats.catalog.modules],
            ['Lessons', stats.catalog.lessons],
            ['Quizzes', stats.catalog.quizzes],
            ['Flashcard decks', stats.catalog.flashcardDecks],
            ['Forums', stats.catalog.forums],
            ['Reviews', stats.catalog.reviews],
            ['Quiz attempts', stats.catalog.quizAttempts],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border/50 px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Top courses by enrollment</h2>
        {stats.topCourses.length === 0 ? (
          <p className="text-xs text-muted-foreground">No courses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 pr-3 font-medium">Course</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Enrolled</th>
                  <th className="py-2 pr-3 font-medium">Avg progress</th>
                  <th className="py-2 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCourses.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/courses/${c.id}`}
                        className="font-medium hover:text-bhutan-orange"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          c.published
                            ? 'bg-green-600/10 text-green-700 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {c.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{c.enrollments}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{c.avgProgress}%</td>
                    <td className="py-2.5 tabular-nums">{c.completions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
