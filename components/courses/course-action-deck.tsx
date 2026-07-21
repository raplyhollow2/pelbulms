'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Clock, Users, Star, Play, CheckCircle, X, Hourglass } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']

interface CourseActionDeckProps {
  course: Course
  isEnrolled?: boolean
  enrollmentPending?: boolean
  onEnroll: () => void
  onLearn?: () => void
}

export function CourseActionDeck({
  course,
  isEnrolled = false,
  enrollmentPending = false,
  onEnroll,
  onLearn,
}: CourseActionDeckProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  const requiresApproval = (course as any).enrollment_mode === 'approval'
  const ctaLabel = isEnrolled
    ? 'Learn'
    : enrollmentPending
      ? 'Pending approval'
      : requiresApproval
        ? 'Request enrollment'
        : 'Enroll'

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector('[data-hero-section]')
      if (heroSection) {
        const rect = heroSection.getBoundingClientRect()
        setIsVisible(rect.bottom < 0)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible) return null

  return (
    <>
      {/* Mobile - Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden p-4 bg-gradient-to-t from-background via-background/95 to-transparent">
        <Card className="glass-strong border-b-0 border-x-0 rounded-b-none shadow-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{course.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    Included with verified account
                  </span>
                  {course.is_featured && (
                    <Badge className="bg-bhutan-yellow text-black text-xs">Featured</Badge>
                  )}
                </div>
              </div>
              <Button
                size="lg"
                className={`whitespace-nowrap ${
                  isEnrolled
                    ? 'bg-green-600 hover:bg-green-700 text-black'
                    : enrollmentPending
                      ? 'bg-amber-500 hover:bg-amber-600 text-black'
                      : 'bg-bhutan-yellow hover:bg-bhutan-orange text-black'
                }`}
                disabled={enrollmentPending}
                onClick={isEnrolled ? onLearn : onEnroll}
              >
                {enrollmentPending ? (
                  <Hourglass className="w-4 h-4 mr-2" />
                ) : (
                  <BookOpen className="w-4 h-4 mr-2" />
                )}
                {ctaLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop - Side Panel */}
      <div className="hidden lg:block fixed right-8 top-1/2 -translate-y-1/2 z-50 w-80">
        <Card className={`glass-strong shadow-2xl transition-all duration-300 ${
          isMinimized ? 'w-16' : 'w-80'
        }`}>
          <CardContent className="p-0">
            {!isMinimized ? (
              <>
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Course Preview</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsMinimized(true)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{course.category}</Badge>
                      <Badge className="text-xs capitalize">{course.level}</Badge>
                    </div>
                    <h4 className="font-semibold text-sm line-clamp-2">{course.title}</h4>
                  </div>
                </div>

                <div className="p-4 border-b border-border/50 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>Duration</span>
                    </div>
                    <span className="font-medium">
                      {course.duration_minutes ? `${Math.floor(course.duration_minutes / 60)}h ${course.duration_minutes % 60}m` : 'Self-paced'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>Students</span>
                    </div>
                    <span className="font-medium">{(course as any).students_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>Rating</span>
                    </div>
                    <span className="font-medium">{(course as any).rating || 'New'}</span>
                  </div>
                </div>

                {course.learning_objectives && course.learning_objectives.length > 0 && (
                  <div className="p-4 border-b border-border/50">
                    <h5 className="text-xs font-semibold mb-2">What you'll learn:</h5>
                    <ul className="space-y-1">
                      {course.learning_objectives.slice(0, 3).map((objective, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Included with verified account
                    </span>
                    {course.is_featured && (
                      <Badge className="bg-bhutan-yellow text-black">Featured</Badge>
                    )}
                  </div>

                  <Button
                    className={`w-full text-black ${
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
                    {isEnrolled ? (
                      <>
                        <BookOpen className="w-5 h-5 mr-2" />
                        Continue Learning
                      </>
                    ) : enrollmentPending ? (
                      <>
                        <Hourglass className="w-5 h-5 mr-2" />
                        Pending approval
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        {requiresApproval ? 'Request enrollment' : 'Enroll Now'}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {enrollmentPending
                      ? 'Waiting for the course creator to approve your request'
                      : requiresApproval && !isEnrolled
                        ? 'This course requires creator approval after you request enrollment'
                        : 'No course fee — enrollment requires a verified account'}
                  </p>
                </div>
              </>
            ) : (
              <div className="p-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-full"
                  onClick={() => setIsMinimized(false)}
                >
                  <BookOpen className="w-6 h-6" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
