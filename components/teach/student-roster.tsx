'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
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
  enrollment: {
    status?: string | null
    enrolled_at?: string | null
    last_accessed_at?: string | null
    completed_at?: string | null
  }
}

function progressOf(student: RosterStudent) {
  if (!student.total_lessons) return 0
  return Math.round((student.completed_lessons / student.total_lessons) * 100)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
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
              {detail.has_certificate ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Certificate</dt>
                  <dd>Issued</dd>
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
