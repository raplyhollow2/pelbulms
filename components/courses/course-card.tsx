'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { BookOpen, Clock, Users, Star, Play } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']

interface CourseCardProps {
  course: Course & { modules?: Module[] }
  progress?: number
  isEnrolled?: boolean
}

export function CourseCard({ course, progress = 0, isEnrolled = false }: CourseCardProps) {
  const [imageError, setImageError] = useState(false)

  const calculateDuration = () => {
    if (!course.modules || course.modules.length === 0) return 'Self-paced'

    // Calculate total duration from modules if available
    const totalMinutes = course.modules?.reduce((sum: number, m: any) =>
      sum + (m.lessons?.reduce((lessonSum: number, l: any) =>
        lessonSum + (l.duration_minutes || 0), 0) || 0), 0)

    if (totalMinutes > 0) {
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }

    return 'Self-paced'
  }

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return 'bg-green-600'
      case 'intermediate': return 'bg-blue-600'
      case 'advanced': return 'bg-purple-600'
      case 'expert': return 'bg-red-600'
      default: return 'bg-gray-600'
    }
  }

  const duration = calculateDuration()

  return (
    <HoverCard>
      <HoverCardTrigger>
        <Link href={`/courses/${course.id}`}>
          <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer h-full overflow-hidden">
            {/* Thumbnail */}
            <div className="relative h-40 overflow-hidden">
              {course.thumbnail_url && !imageError ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-bhutan-yellow" />
                </div>
              )}

              {/* Play Button Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-bhutan-yellow flex items-center justify-center">
                  <Play className="w-6 h-6 text-black ml-1" />
                </div>
              </div>

              {/* Badge */}
              {course.is_featured && (
                <Badge className="absolute top-3 right-3 bg-bhutan-yellow text-black">
                  Featured
                </Badge>
              )}
            </div>

            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1 line-clamp-2 group-hover:text-bhutan-yellow transition-colors">
                    {course.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {course.category}
                    </Badge>
                    <Badge className={`text-xs ${getLevelColor(course.level)}`}>
                      {course.level}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{duration}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{(course as any).students_count || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span>{(course as any).rating || 'New'}</span>
                </div>
              </div>

              {/* Progress Bar for Enrolled Courses */}
              {isEnrolled && progress > 0 && (
                <div className="space-y-1">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress}% complete</span>
                    <span>{Math.round((course.modules?.length || 0) * (progress / 100))} of {course.modules?.length || 0} modules</span>
                  </div>
                </div>
              )}

              {/* Price or Continue Button */}
              <div className="mt-3">
                {isEnrolled ? (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    Continue Learning
                  </Button>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-bhutan-yellow">
                      ${course.price === 0 ? 'Free' : course.price}
                    </span>
                    <Button
                      className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                      size="sm"
                    >
                      Enroll Now
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </HoverCardTrigger>

      {/* Hover Card Content */}
      <HoverCardContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-3">
          <div>
            <h4 className="font-semibold mb-2">{course.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {course.description || 'No description available.'}
            </p>
          </div>

          {course.learning_objectives && course.learning_objectives.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold mb-2">What you'll learn:</h5>
              <ul className="text-xs space-y-1">
                {(course.learning_objectives as string[]).slice(0, 3).map((objective, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span className="text-muted-foreground">{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {course.prerequisites && course.prerequisites.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold mb-2">Prerequisites:</h5>
              <div className="flex flex-wrap gap-1">
                {(course.prerequisites as string[]).map((prereq, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {prereq}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t">
            <Button
              className="w-full bg-bhutan-yellow hover:bg-bhutan-orange text-black"
              size="sm"
              onClick={() => window.location.href = `/courses/${course.id}`}
            >
              {isEnrolled ? 'Continue Learning' : 'View Course Details'}
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}