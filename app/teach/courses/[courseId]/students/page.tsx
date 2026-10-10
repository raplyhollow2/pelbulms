'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StudentRoster } from '@/components/teach/student-roster'
import { EnrollmentInvitePanel } from '@/components/teach/enrollment-invite-panel'
import { CourseStaffPanel } from '@/components/teach/course-staff-panel'
import { StudentInterventionPanel } from '@/components/teach/student-intervention-panel'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Enrollment = Database['public']['Tables']['enrollments']['Row']

type StudentWithProgress = Profile & {
  enrollment: Enrollment
  completed_lessons: number
  total_lessons: number
  has_certificate: boolean
}

type StudentIdentity = {
  cid_number: string | null
  dzongkhag: string | null
  gewog: string | null
  institution: string | null
}

export default function CourseStudentsPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string

  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<StudentWithProgress[]>([])
  const [identities, setIdentities] = useState<Record<string, StudentIdentity>>({})
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchStudentsData()
  }, [courseId])

  const fetchStudentsData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Fetch course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (!courseData) {
        alert('Course not found')
        router.push('/teach/dashboard')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const role = (profile as any)?.role
      const { data: staffRow } = await (supabase as any)
        .from('course_instructors')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle()
      const isOwner = (courseData as any).instructor_id === user.id
      const isStaff = role === 'admin' || role === 'superadmin'
      const isCoTeacher = Boolean(staffRow)
      if (!isOwner && !isStaff && !isCoTeacher) {
        alert('Access denied. You can only view students for your own courses.')
        router.push('/teach/dashboard')
        return
      }

      setCourse(courseData)

      // Roster via service-role API (client RLS only allows course owners to read enrollments)
      const rosterRes = await fetch(
        `/api/teach/enrollments?courseId=${encodeURIComponent(courseId)}`
      )
      const rosterData = await rosterRes.json().catch(() => ({}))
      if (!rosterRes.ok) {
        throw new Error(rosterData?.error || 'Failed to load enrollments')
      }
      if (rosterData?.identities) setIdentities(rosterData.identities)
      setStudents((rosterData?.students || []) as StudentWithProgress[])

    } catch (error) {
      console.error('Error fetching students data:', error)
      alert('Failed to load students data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const rosterStudents = students.filter(
    (student: any) => (student.enrollment as any).status !== 'pending'
  )

  const getProgressPercentage = (student: StudentWithProgress) => {
    if (student.total_lessons === 0) return 0
    return Math.round((student.completed_lessons / student.total_lessons) * 100)
  }

  const pendingStudents = students.filter(
    (s: any) => (s.enrollment as any).status === 'pending'
  )
  const activeStudents = students.filter((s: any) => {
    const status = (s.enrollment as any).status
    return status === 'active' || status === 'completed'
  })

  const getAverageProgress = () => {
    const pool = activeStudents.length > 0 ? activeStudents : students
    if (pool.length === 0) return 0
    const total = pool.reduce((sum, student) => sum + getProgressPercentage(student), 0)
    return Math.round(total / pool.length)
  }

  const getCompletedCount = () => {
    return students.filter((student: any) => (student.enrollment as any).status === 'completed').length
  }

  const handleEnrollmentDecision = async (
    enrollmentId: string,
    action: 'approve' | 'reject'
  ) => {
    try {
      setDecidingId(enrollmentId)
      const res = await fetch('/api/teach/enrollments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update enrollment')
      await fetchStudentsData()
    } catch (e: any) {
      alert(e?.message || 'Failed to update enrollment')
    } finally {
      setDecidingId(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading students...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            onClick={() => router.push('/teach/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Students & enrollment requests</h1>
            <p className="text-sm sm:text-base text-muted-foreground truncate">{course?.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Only the course creator (or a platform admin) can approve enrollment requests.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => router.push(`/teach/courses/${courseId}/grading`)}
          >
            Grading queue
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <Card className="bg-card/80 border border-border hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{activeStudents.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active enrollments</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border border-border hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{pendingStudents.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting your approval</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border border-border hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{getCompletedCount()}</div>
              <p className="text-xs text-muted-foreground mt-1">Finished course</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 border border-border hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{getAverageProgress()}%</div>
              <p className="text-xs text-muted-foreground mt-1">Among active students</p>
            </CardContent>
          </Card>
        </div>

        <EnrollmentInvitePanel courseId={courseId} />
        <CourseStaffPanel courseId={courseId} />
        <StudentInterventionPanel courseId={courseId} students={students} />
        {pendingStudents.length > 0 && (
          <Card className="bg-card border border-border shadow-sm border-amber-500/30">
            <CardHeader>
              <CardTitle>Enrollment requests</CardTitle>
              <CardDescription>
                These learners requested access. As course creator, approve to grant learning access, or reject.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingStudents.map((student) => {
                const identity = identities[student.id]
                const place = [identity?.gewog, identity?.dzongkhag].filter(Boolean).join(', ')
                return (
                <div
                  key={student.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{student.full_name || 'Anonymous'}</p>
                    {(student as any).email && (
                      <p className="text-sm text-muted-foreground truncate">
                        {(student as any).email}
                      </p>
                    )}
                    {(identity?.cid_number || identity?.institution || place) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {identity?.cid_number ? `CID ${identity.cid_number}` : 'KYC verified'}
                        {identity?.institution ? ` · ${identity.institution}` : ''}
                        {place ? ` · ${place}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={decidingId === student.enrollment.id}
                      onClick={() =>
                        handleEnrollmentDecision(student.enrollment.id, 'approve')
                      }
                    >
                      {decidingId === student.enrollment.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decidingId === student.enrollment.id}
                      onClick={() =>
                        handleEnrollmentDecision(student.enrollment.id, 'reject')
                      }
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">All students</h2>
            <p className="text-sm text-muted-foreground">View individual student progress and performance</p>
          </div>
          <StudentRoster courseId={courseId} students={rosterStudents} />
        </section>
      </div>
    </div>
  )
}