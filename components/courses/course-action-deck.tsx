'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, Users, Star, Play, CheckCircle, Hourglass } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']

interface CourseActionDeckProps {
  course: Course
  isEnrolled?: boolean
  enrollmentPending?: boolean
  onEnroll: () => void
  onLearn?: () => void
  sticky?: boolean
  inviteMode?: boolean
  inviteCode?: string
  onInviteCodeChange?: (value: string) => void
  variant?: 'sidebar' | 'mobile' | 'both'
}

export function CourseActionDeck({
  course,
  isEnrolled = false,
  enrollmentPending = false,
  onEnroll,
  onLearn,
  sticky = true,
  inviteMode = false,
  inviteCode = '',
  onInviteCodeChange,
  variant = 'both',
}: CourseActionDeckProps) {
  const requiresApproval = (course as any).enrollment_mode === 'approval'
  const duration = course.duration_minutes
    ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m`
    : 'Self-paced'

  const cta = isEnrolled ? (
    <>
      <BookOpen className="mr-2 h-5 w-5" />
      Continue Learning
    </>
  ) : enrollmentPending ? (
    <>
      <Hourglass className="mr-2 h-5 w-5" />
      Pending approval
    </>
  ) : inviteMode ? (
    <>
      <Play className="mr-2 h-5 w-5" />
      Enroll with code
    </>
  ) : requiresApproval ? (
    <>
      <Play className="mr-2 h-5 w-5" />
      Request enrollment
    </>
  ) : (
    <>
      <Play className="mr-2 h-5 w-5" />
      Enroll Now
    </>
  )

  const body = (
    <Card className="border-border/60 shadow-lg">
      <CardContent className="p-0">
        <div className="border-b border-border/50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Course preview
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {course.category}
            </Badge>
            <Badge className="text-xs capitalize">{course.level}</Badge>
          </div>
          <h3 className="line-clamp-3 text-base font-semibold leading-snug">{course.title}</h3>
        </div>

        <div className="space-y-2 border-b border-border/50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" /> Duration
            </span>
            <span className="font-medium">{duration}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" /> Students
            </span>
            <span className="font-medium">{(course as any).enrollment_count || (course as any).students_count || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> Rating
            </span>
            <span className="font-medium">
              {(course as any).average_rating
                ? Number((course as any).average_rating).toFixed(1)
                : 'New'}
            </span>
          </div>
        </div>

        {course.learning_objectives && course.learning_objectives.length > 0 && (
          <div className="border-b border-border/50 p-4">
            <h5 className="mb-2 text-xs font-semibold">What you&apos;ll learn</h5>
            <ul className="space-y-1.5">
              {course.learning_objectives.slice(0, 4).map((objective, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                  <span className="line-clamp-2">{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3 p-4">
          {inviteMode && !isEnrolled && !enrollmentPending && (
            <input
              value={inviteCode}
              onChange={(e) => onInviteCodeChange?.(e.target.value.toUpperCase())}
              placeholder="Enter your enrollment code"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Enrollment code"
            />
          )}
          <p className="text-sm text-muted-foreground">
            {isEnrolled
              ? 'Pick up where you left off'
              : enrollmentPending
                ? 'Waiting for the course creator to approve'
                : inviteMode
                  ? 'Your teacher sends a unique code by email or SMS'
                  : 'Included with a verified account'}
          </p>
          <Button
            className={`min-h-11 w-full text-black ${
              isEnrolled
                ? 'bg-green-600 hover:bg-green-700'
                : enrollmentPending
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-bhutan-yellow hover:bg-bhutan-orange'
            }`}
            size="lg"
            disabled={enrollmentPending}
            onClick={isEnrolled ? onLearn : onEnroll}
          >
            {cta}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <>
      {variant !== 'mobile' && (
        <div className={sticky ? 'lg:sticky lg:top-24' : ''}>{body}</div>
      )}
      {variant !== 'sidebar' && (
        <div className="fixed inset-x-0 z-40 px-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{course.title}</p>
              <p className="text-xs text-muted-foreground">
                {isEnrolled ? 'Resume from last lesson' : 'Verified account required'}
              </p>
            </div>
            <Button
              size="lg"
              className={`min-h-11 shrink-0 text-black ${
                isEnrolled
                  ? 'bg-green-600 hover:bg-green-700'
                  : enrollmentPending
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-bhutan-yellow hover:bg-bhutan-orange'
              }`}
              disabled={enrollmentPending}
              onClick={isEnrolled ? onLearn : onEnroll}
            >
              {isEnrolled ? 'Resume' : enrollmentPending ? 'Pending' : 'Enroll'}
            </Button>
          </div>
        </div>
      </div>
      )}
    </>
  )
}
