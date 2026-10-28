'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { RoleReportDashboard } from '@/components/reports/role-report-dashboard'
import {
  ReportScopeBar,
  scopeFromSearchParams,
  scopeQueryString,
  type ReportScopeSelection,
} from '@/components/reports/report-scope-bar'
import type { ReportRange, ReportSnapshot } from '@/lib/reports/types'
import { canAccessTeaching } from '@/lib/roles'
import { createClient } from '@/lib/supabase/client'

function sectionForBlock(snapshot: ReportSnapshot, blockId: string) {
  return snapshot.sections.find((s) => s.blocks.some((b) => b.id === blockId))?.section
}

export default function TeachReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const focusBlockId = searchParams.get('focus')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState('instructor')
  const [range, setRange] = useState<ReportRange>(
    () => (searchParams.get('range') as ReportRange) || '30d'
  )
  const [scope, setScope] = useState<ReportScopeSelection>(() =>
    scopeFromSearchParams(searchParams)
  )
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null)
  const [approvalsSnap, setApprovalsSnap] = useState<ReportSnapshot | null>(null)
  const [mode, setMode] = useState<'courses' | 'approvals'>('courses')
  const [deepDive, setDeepDive] = useState('')
  const [instructorFilter, setInstructorFilter] = useState('all')
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>([])

  const syncUrl = useCallback(
    (nextRange: ReportRange, nextScope: ReportScopeSelection, focus?: string | null) => {
      const q = scopeQueryString(nextScope, {
        range: nextRange,
        audience: 'instructor',
        instructorId: instructorFilter,
      })
      const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q)
      if (focus) params.set('focus', focus)
      const qs = params.toString()
      router.replace(qs ? `/teach/reports?${qs}` : '/teach/reports', { scroll: false })
    },
    [instructorFilter, router]
  )

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const userRole = (profile as any)?.role || 'student'
      if (!canAccessTeaching(userRole)) {
        router.push('/dashboard')
        return
      }
      setRole(userRole)

      if (userRole === 'superadmin') {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('role', ['instructor', 'admin', 'resource_person', 'superadmin'])
          .order('full_name')
        setInstructors(
          ((people || []) as any[]).map((p) => ({
            id: p.id,
            name: p.full_name || 'Instructor',
          }))
        )
      }

      const teachQs = scopeQueryString(scope, {
        range,
        audience: 'instructor',
        instructorId: userRole === 'superadmin' ? instructorFilter : undefined,
      })
      const teachRes = await fetch(`/api/reports/snapshot${teachQs}`)
      const teachJson = await teachRes.json()
      if (teachRes.status === 403) {
        setScope({ courseId: '', institutionId: '', enrollmentStatus: 'all' })
        throw new Error(teachJson.error || 'Filter not allowed — cleared scope')
      }
      if (!teachRes.ok) throw new Error(teachJson.error || 'Failed to load reports')
      const teachSnap = teachJson.snapshot as ReportSnapshot
      setSnapshot(teachSnap)
      setDeepDive((prev) => prev || teachSnap?.sections?.[0]?.section || '')

      if (userRole === 'resource_person') {
        const apQs = scopeQueryString(
          { ...scope, enrollmentStatus: 'all' },
          { range, audience: 'resource_person' }
        )
        const apRes = await fetch(`/api/reports/snapshot${apQs}`)
        const apJson = await apRes.json()
        if (apRes.ok) setApprovalsSnap(apJson.snapshot)
      } else {
        setApprovalsSnap(null)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [range, router, instructorFilter, scope])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!focusBlockId || !snapshot) return
    const section = sectionForBlock(snapshot, focusBlockId)
    if (section) {
      setMode('courses')
      setDeepDive(section)
    }
  }, [focusBlockId, snapshot])

  const onRangeChange = (r: ReportRange) => {
    setRange(r)
    syncUrl(r, scope, focusBlockId)
  }

  const onScopeChange = (next: ReportScopeSelection) => {
    setScope(next)
    syncUrl(range, next, focusBlockId)
  }

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
      <div className="container mx-auto space-y-4 px-4 py-8">
        <p className="text-destructive">{error}</p>
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => {
            setError(null)
            void load()
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  const activeSnap =
    mode === 'approvals' && approvalsSnap ? approvalsSnap : snapshot
  if (!activeSnap) {
    return (
      <div className="container mx-auto px-4 py-8 text-muted-foreground">No report data.</div>
    )
  }

  return (
    <div className="container mx-auto space-y-4 px-4 py-8">
      <ReportScopeBar
        value={scope}
        onChange={onScopeChange}
        showEnrollmentStatus={mode === 'courses'}
        audience={mode === 'approvals' ? 'resource_person' : 'instructor'}
      />
      {role === 'superadmin' && mode === 'courses' ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="instructor-filter">
            Instructor
          </label>
          <select
            id="instructor-filter"
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">All instructors</option>
            {instructors.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {approvalsSnap ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('courses')}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === 'courses'
                ? 'border-primary/40 bg-primary/20'
                : 'border-border/60 text-muted-foreground'
            }`}
          >
            Course insights
          </button>
          <button
            type="button"
            onClick={() => setMode('approvals')}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === 'approvals'
                ? 'border-primary/40 bg-primary/20'
                : 'border-border/60 text-muted-foreground'
            }`}
          >
            Approvals health
          </button>
        </div>
      ) : null}
      <RoleReportDashboard
        snapshot={activeSnap}
        range={range}
        onRangeChange={onRangeChange}
        badge={
          mode === 'approvals'
            ? 'Resource person'
            : role === 'resource_person'
              ? 'Resource person'
              : 'Instructor'
        }
        showDeepDive
        deepDiveSection={deepDive}
        onDeepDiveChange={setDeepDive}
        focusBlockId={mode === 'courses' ? focusBlockId : null}
        scopeFilters={{
          courseId: scope.courseId || undefined,
          institutionId: scope.institutionId || undefined,
          enrollmentStatus:
            scope.enrollmentStatus !== 'all' ? scope.enrollmentStatus : undefined,
        }}
        onInterveneDone={() => void load()}
      />
    </div>
  )
}
