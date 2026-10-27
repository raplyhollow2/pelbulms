'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Award, Download, ShieldCheck } from 'lucide-react'
import { DataTable } from '@/components/data-table/data-table'
import { PersonHoverCard } from '@/components/people/person-hover-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type RosterStudent = {
  id: string
  full_name?: string | null
  email?: string | null
  avatar_url?: string | null
  completed_lessons: number
  total_lessons: number
  has_certificate: boolean
  certificate_url?: string | null
  verification_code?: string | null
  issued_at?: string | null
  enrollment: {
    status?: string | null
    progress_percentage?: number | null
    enrolled_at?: string | null
    last_accessed_at?: string | null
    completed_at?: string | null
  }
}

function progressOf(student: RosterStudent) {
  const enrollmentPct = Number(student.enrollment.progress_percentage)
  if (Number.isFinite(enrollmentPct) && enrollmentPct > 0) {
    return Math.min(100, Math.round(enrollmentPct))
  }
  if (!student.total_lessons) return 0
  return Math.round((student.completed_lessons / student.total_lessons) * 100)
}

function isCourseComplete(student: RosterStudent) {
  return (
    progressOf(student) >= 100 ||
    student.enrollment.status === 'completed' ||
    Boolean(student.enrollment.completed_at)
  )
}

function certificateLabel(student: RosterStudent) {
  if (student.certificate_url || student.has_certificate) return 'Issued'
  if (isCourseComplete(student)) return 'Completed — not claimed'
  return '—'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function openCertificate(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function downloadCertificate(url: string, name?: string | null) {
  const link = document.createElement('a')
  link.href = url
  link.download = `${(name || 'certificate').replace(/[^\w\-]+/g, '_')}.pdf`
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function StudentRoster({
  courseId,
  students,
}: {
  courseId: string
  students: RosterStudent[]
}) {
  const router = useRouter()
  const [detail, setDetail] = useState<RosterStudent | null>(null)

  const columns: ColumnDef<RosterStudent, unknown>[] = [
    {
      id: 'name',
      accessorFn: (student) => student.full_name || '',
      header: 'Student',
      cell: ({ row }) => {
        const student = row.original
        const status = student.enrollment.status || 'active'
        return (
          <PersonHoverCard
            name={student.full_name || 'Anonymous'}
            email={student.email}
            lines={[status, `${progressOf(student)}% complete`]}
            onOpen={() => setDetail(student)}
          />
        )
      },
    },
    {
      id: 'status',
      accessorFn: (student) => student.enrollment.status || 'active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.enrollment.status || 'active'}
        </Badge>
      ),
    },
    {
      id: 'progress',
      accessorFn: (student) => progressOf(student),
      header: 'Progress',
      cell: ({ row }) => {
        const value = progressOf(row.original)
        return (
          <div className="flex min-w-[8rem] items-center gap-2">
            <Progress value={value} className="h-1.5" />
            <span className="w-10 text-xs tabular-nums text-muted-foreground">{value}%</span>
          </div>
        )
      },
    },
    {
      id: 'certificate',
      accessorFn: (student) => certificateLabel(student),
      header: 'Certificate',
      cell: ({ row }) => {
        const student = row.original
        const label = certificateLabel(student)
        if (label === 'Issued' && student.certificate_url) {
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="bg-green-600/10 text-green-700 dark:text-green-400">
                Issued
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => openCertificate(student.certificate_url!)}
              >
                <Award className="mr-1 h-3.5 w-3.5" />
                View
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => downloadCertificate(student.certificate_url!, student.full_name)}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          )
        }
        if (label === 'Completed — not claimed') {
          return (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Completed — not claimed
            </span>
          )
        }
        return <span className="text-sm text-muted-foreground">—</span>
      },
    },
    {
      id: 'enrolled',
      accessorFn: (student) => student.enrollment.enrolled_at || '',
      header: 'Enrolled',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.enrollment.enrolled_at)}</span>
      ),
    },
    {
      id: 'open',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/teach/courses/${courseId}/students/${row.original.id}`)}
          >
            Open
          </Button>
        </div>
      ),
    },
  ]

  const detailProgress = detail ? progressOf(detail) : 0
  const detailCertLabel = detail ? certificateLabel(detail) : '—'

  return (
    <>
      <DataTable
        data={students}
        columns={columns}
        searchPlaceholder="Search students…"
        emptyTitle="No students enrolled yet"
        emptyDescription="Approved learners will appear in this roster."
        getSearchText={(student) => `${student.full_name || ''} ${student.email || ''}`}
      />

      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{detail?.full_name || 'Student'}</SheetTitle>
            <SheetDescription>{detail?.email || 'No email on file'}</SheetDescription>
          </SheetHeader>
          {detail ? (
            <dl className="space-y-3 px-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{detail.enrollment.status || 'active'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Progress</dt>
                <dd>
                  {detailProgress}% · {detail.completed_lessons}/{detail.total_lessons} lessons
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Enrolled</dt>
                <dd>{formatDate(detail.enrollment.enrolled_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last active</dt>
                <dd>{formatDate(detail.enrollment.last_accessed_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Certificate</dt>
                <dd>{detailCertLabel}</dd>
              </div>
              {detail.certificate_url ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCertificate(detail.certificate_url!)}
                  >
                    <Award className="mr-1 h-3.5 w-3.5" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCertificate(detail.certificate_url!, detail.full_name)}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Download
                  </Button>
                  {detail.verification_code ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        window.open(`/verify/${detail.verification_code}`, '_blank', 'noopener,noreferrer')
                      }
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      Verify
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </dl>
          ) : null}
          <SheetFooter>
            {detail ? (
              <Button
                type="button"
                onClick={() => router.push(`/teach/courses/${courseId}/students/${detail.id}`)}
              >
                Open full record
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
