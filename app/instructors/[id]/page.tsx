'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Loader2,
  Star,
  Users,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveMediaUrl } from '@/lib/media'
import {
  buildInstructorShowcaseData,
  type InstructorShowcaseData,
} from '@/lib/instructor-stats'

export default function InstructorProfilePage() {
  const params = useParams()
  const router = useRouter()
  const instructorId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [instructor, setInstructor] = useState<InstructorShowcaseData | null>(null)
  const [courses, setCourses] = useState<any[]>([])
  const [earnedCerts, setEarnedCerts] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructorId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', instructorId)
        .single()

      if (profileError || !profile) {
        throw new Error('Instructor not found')
      }

      const { data: instructorCourses } = await supabase
        .from('courses')
        .select(
          'id, title, slug, description, category, tags, level, thumbnail_url, average_rating, rating_count, enrollment_count, is_published'
        )
        .eq('instructor_id', instructorId)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      const courseList = (instructorCourses || []) as any[]
      const courseIds = courseList.map((c) => c.id)

      let studentsCount = 0
      let certificatesIssuedToStudents = 0
      if (courseIds.length > 0) {
        const { count: enrollCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .in('course_id', courseIds)
        studentsCount = enrollCount || 0

        const { count: certCount } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .in('course_id', courseIds)
        certificatesIssuedToStudents = certCount || 0
      }

      const { data: earned } = await supabase
        .from('certificates')
        .select('id, issued_at, certificate_url, verification_code, courses(title)')
        .eq('user_id', instructorId)
        .order('issued_at', { ascending: false })

      const earnedList = (earned || []) as any[]
      setEarnedCerts(earnedList)
      setCourses(courseList)

      setInstructor(
        buildInstructorShowcaseData({
          id: (profile as any).id,
          full_name: (profile as any).full_name,
          avatar_url: (profile as any).avatar_url,
          bio: (profile as any).bio,
          metadata: (profile as any).metadata || {},
          courses: courseList,
          studentsCount,
          earnedCertificates: earnedList.map((c) => ({
            courseTitle: c.courses?.title || null,
            issuedAt: c.issued_at || null,
          })),
          certificatesIssuedToStudents,
        })
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to load instructor')
    } finally {
      setLoading(false)
    }
  }

  const initials = (instructor?.full_name || 'IN')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  if (error || !instructor) {
    return (
      <div className="container mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">{error || 'Instructor not found'}</p>
        <Button variant="outline" onClick={() => router.push('/courses')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to courses
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <Button variant="ghost" onClick={() => router.push('/courses')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Courses
      </Button>

      <Card className="glass-strong">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar className="w-24 h-24 border-4 border-bhutan-yellow shrink-0">
              <AvatarImage src={resolveMediaUrl(instructor.avatar_url) || undefined} />
              <AvatarFallback className="bg-bhutan-yellow text-black text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{instructor.full_name}</h1>
                {instructor.expertise[0] && instructor.expertise[0] !== 'Instructor' && (
                  <p className="text-muted-foreground mt-1">
                    {instructor.expertise.slice(0, 3).join(' · ')}
                  </p>
                )}
              </div>
              {instructor.bio && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{instructor.bio}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {instructor.expertise
                  .filter((e) => e !== 'Instructor')
                  .map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="rounded-lg border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-bhutan-yellow font-bold text-xl">
                    <Star className="w-4 h-4 fill-current" />
                    {instructor.rating ?? '—'}
                  </div>
                  <p className="text-xs text-muted-foreground">Avg rating</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-xl">
                    <Users className="w-4 h-4 text-bhutan-orange" />
                    {instructor.students_count.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Students</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-xl">
                    <BookOpen className="w-4 h-4 text-bhutan-yellow" />
                    {instructor.courses_count}
                  </div>
                  <p className="text-xs text-muted-foreground">Courses</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-xl">
                    <Award className="w-4 h-4 text-green-600" />
                    {earnedCerts.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Certificates earned</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {instructor.achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-bhutan-yellow" /> Achievements
            </CardTitle>
            <CardDescription>Based on courses taught and certificates earned</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {instructor.achievements.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-bhutan-yellow shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {earnedCerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Certificates earned</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {earnedCerts.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {cert.courses?.title || 'Course certificate'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cert.issued_at
                      ? new Date(cert.issued_at).toLocaleDateString()
                      : 'Issued'}
                    {cert.verification_code ? ` · ${cert.verification_code}` : ''}
                  </p>
                </div>
                {cert.certificate_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(cert.certificate_url, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> View
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Courses by {instructor.full_name}</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published courses yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-12 rounded bg-muted overflow-hidden shrink-0">
                      {course.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveMediaUrl(course.thumbnail_url) || course.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm line-clamp-2">{course.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {course.category && (
                          <Badge variant="outline" className="text-[10px]">
                            {course.category}
                          </Badge>
                        )}
                        {course.level && (
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {course.level}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
