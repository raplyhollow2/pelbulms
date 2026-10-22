'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReportRange } from '@/lib/reports/types'

export type ReportScopeSelection = {
  courseId: string
  institutionId: string
  enrollmentStatus: string
}

type Option = { id: string; name: string }

const ENROLLMENT_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'suspended', label: 'Suspended' },
]

export function ReportScopeBar({
  value,
  onChange,
  showEnrollmentStatus = true,
  className,
}: {
  value: ReportScopeSelection
  onChange: (next: ReportScopeSelection) => void
  showEnrollmentStatus?: boolean
  className?: string
}) {
  const [institutions, setInstitutions] = useState<Option[]>([])
  const [courses, setCourses] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/reports/scope-options')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load filters')
        if (cancelled) return
        setInstitutions(json.institutions || [])
        setCourses(json.courses || [])
      } catch {
        if (!cancelled) {
          setInstitutions([])
          setCourses([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredCourses = useMemo(() => {
    if (!value.institutionId) return courses
    // Client cannot know course↔org links without another fetch; keep all courses.
    // Selecting an invalid combo is rejected by the snapshot API (403 → clear).
    return courses
  }, [courses, value.institutionId])

  if (loading && institutions.length === 0 && courses.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">Loading filters…</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end gap-3">
        {institutions.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Organization</span>
            <select
              value={value.institutionId}
              onChange={(e) =>
                onChange({ ...value, institutionId: e.target.value, courseId: '' })
              }
              className="h-9 min-w-[10rem] rounded-md border border-border bg-background px-2"
            >
              <option value="">All organizations</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {filteredCourses.length > 0 || value.courseId ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Course</span>
            <select
              value={value.courseId}
              onChange={(e) => onChange({ ...value, courseId: e.target.value })}
              className="h-9 min-w-[12rem] rounded-md border border-border bg-background px-2"
            >
              <option value="">All courses</option>
              {filteredCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showEnrollmentStatus ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Enrollment</span>
            <select
              value={value.enrollmentStatus || 'all'}
              onChange={(e) => onChange({ ...value, enrollmentStatus: e.target.value })}
              className="h-9 min-w-[9rem] rounded-md border border-border bg-background px-2"
            >
              {ENROLLMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  )
}

export function scopeQueryString(
  scope: ReportScopeSelection,
  extras?: { range?: ReportRange; audience?: string; instructorId?: string }
): string {
  const params = new URLSearchParams()
  if (extras?.range) params.set('range', extras.range)
  if (extras?.audience) params.set('audience', extras.audience)
  if (extras?.instructorId && extras.instructorId !== 'all') {
    params.set('instructorId', extras.instructorId)
  }
  if (scope.courseId) params.set('courseId', scope.courseId)
  if (scope.institutionId) params.set('institutionId', scope.institutionId)
  if (scope.enrollmentStatus && scope.enrollmentStatus !== 'all') {
    params.set('enrollmentStatus', scope.enrollmentStatus)
  }
  const q = params.toString()
  return q ? `?${q}` : ''
}

export function scopeFromSearchParams(searchParams: URLSearchParams): ReportScopeSelection {
  return {
    courseId: searchParams.get('courseId') || '',
    institutionId: searchParams.get('institutionId') || '',
    enrollmentStatus: searchParams.get('enrollmentStatus') || 'all',
  }
}
