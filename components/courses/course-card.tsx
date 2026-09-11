'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { BookOpen, Check, Loader2, Star } from 'lucide-react'
import type { Database } from '@/types/database.types'
import { resolveMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface CourseCardProps {
  course: Course & {
    modules?: Module[] | { id?: string; count?: number }[]
    students_count?: number
    modules_count?: number
    enrollment_count?: number
    profiles?: Pick<Profile, 'full_name' | 'avatar_url' | 'bio'> | null
  }
  progress?: number
  isEnrolled?: boolean
  enrollmentPending?: boolean
  requesting?: boolean
  onRequestEnrollment?: (courseId: string) => void
}

function moduleCount(course: CourseCardProps['course']) {
  if (typeof course.modules_count === 'number') return course.modules_count
  const modules = course.modules
  if (!modules || modules.length === 0) return 0
  const first = modules[0] as { count?: number }
  if (typeof first?.count === 'number') return first.count
  return modules.length
}

function studentCount(course: CourseCardProps['course']) {
  if (typeof course.students_count === 'number') return course.students_count
  if (typeof course.enrollment_count === 'number') return course.enrollment_count
  return 0
}

function Chip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/80',
        className
      )}
    >
      {children}
    </span>
  )
}

export function CourseCard({
  course,
  progress = 0,
  isEnrolled = false,
  enrollmentPending = false,
  requesting = false,
  onRequestEnrollment,
}: CourseCardProps) {
  const [imageError, setImageError] = useState(false)

  const thumbSrc = resolveMediaUrl(course.thumbnail_url)
  const modules = moduleCount(course)
  const students = studentCount(course)
  const brief = (course.description || '').trim() || 'No description available.'
  const instructorName =
    course.profiles?.full_name?.trim() ||
    (course as { instructor_name?: string }).instructor_name ||
    'Instructor'
  const rating =
    typeof course.average_rating === 'number' && course.average_rating > 0
      ? course.average_rating
      : null
  const ratingCount =
    typeof course.rating_count === 'number' ? course.rating_count : 0

  const enrollmentMode = (course as { enrollment_mode?: string }).enrollment_mode
  const requiresApproval =
    enrollmentMode !== 'auto' &&
    enrollmentMode !== 'invite_code' &&
    enrollmentMode !== 'paid'
  const requestOnThisPage = Boolean(
    onRequestEnrollment && !isEnrolled && requiresApproval
  )
  const ctaLabel = requesting
    ? 'Sending request'
    : isEnrolled
      ? 'Continue learning'
      : enrollmentPending
        ? 'Pending approval'
        : enrollmentMode === 'auto' ||
            enrollmentMode === 'invite_code' ||
            enrollmentMode === 'paid'
          ? 'Enroll now'
          : 'Request enrollment'
  const ctaClassName = cn(
    'h-9 w-full rounded-full text-sm font-medium',
    isEnrolled
      ? 'bg-green-600 text-white hover:bg-green-700'
      : enrollmentPending
        ? 'bg-amber-500 text-black hover:bg-amber-600'
        : 'bg-bhutan-yellow text-black hover:bg-bhutan-orange'
  )

  return (
    <Card className="group flex h-full flex-col gap-0 overflow-hidden border-border/60 bg-card py-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative w-full overflow-hidden bg-muted pt-[56.25%]">
        <Link
          href={`/courses/${course.id}`}
          className="absolute inset-0 block"
          aria-label={course.title}
        >
          {thumbSrc && !imageError ? (
            <img
              src={thumbSrc}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20">
              <BookOpen className="h-12 w-12 text-bhutan-yellow" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <p className="line-clamp-3 text-xs leading-relaxed text-white/95 sm:text-sm">
              {brief}
            </p>
          </div>
        </Link>

        {course.is_featured && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full bg-bhutan-orange px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            <Check className="h-3 w-3" strokeWidth={3} />
            Featured
          </span>
        )}
      </div>

      <Link href={`/courses/${course.id}`} className="block flex-1 cursor-pointer">
        <CardContent className="flex flex-1 flex-col gap-2.5 px-3.5 py-3">
          <div className="space-y-1">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-foreground">
              {course.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{instructorName}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {course.category && <Chip className="capitalize">{course.category}</Chip>}
            {course.level && <Chip className="capitalize">{course.level}</Chip>}
            {rating != null ? (
              <Chip>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
              </Chip>
            ) : (
              <Chip>New</Chip>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip>
              {modules} {modules === 1 ? 'module' : 'modules'}
            </Chip>
            <Chip>
              {students.toLocaleString()}{' '}
              {students === 1 ? 'student' : 'students'}
            </Chip>
            {ratingCount > 0 && (
              <Chip>{ratingCount.toLocaleString()} ratings</Chip>
            )}
          </div>

          {isEnrolled && progress > 0 && (
            <div className="space-y-1 pt-0.5">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-muted-foreground">{progress}% complete</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Link>

      <div className="mt-auto px-3.5 pb-3.5">
        {requestOnThisPage ? (
          <Button
            type="button"
            nativeButton
            disabled={requesting || enrollmentPending}
            className={ctaClassName}
            onClick={() => onRequestEnrollment?.(course.id)}
          >
            {requesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {ctaLabel}
              </>
            ) : (
              ctaLabel
            )}
          </Button>
        ) : (
          <Button className={ctaClassName} render={<Link href={`/courses/${course.id}`} />}>
            {ctaLabel}
          </Button>
        )}
      </div>
    </Card>
  )
}
