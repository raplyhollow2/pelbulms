'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { BookOpen, Clock, Users, Star, Play, Award, TrendingUp } from 'lucide-react'
import type { Database } from '@/types/database.types'
import { resolveMediaUrl } from '@/lib/media'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']

interface CourseCardProps {
  course: Course & { modules?: Module[] }
  progress?: number
  isEnrolled?: boolean
}

export function CourseCard({ course, progress = 0, isEnrolled = false }: CourseCardProps) {
  const [imageError, setImageError] = useState(false)
  const thumbSrc = resolveMediaUrl(course.thumbnail_url)

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
    <HoverCard openDelay={300} closeDelay={200}>
      <HoverCardTrigger
        render={<Link href={`/courses/${course.id}`} className="block h-full" />}
      >
          <Card className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full overflow-hidden border-border/50 hover:border-bhutan-yellow/30">
        {/* Thumbnail - 16:9 Aspect Ratio (Standard Video Format) */}
        <div className="relative w-full pt-[56.25%] overflow-hidden bg-gray-900 rounded-t-lg">
          {thumbSrc && !imageError ? (
            <img
              src={thumbSrc}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-bhutan-yellow" />
            </div>
          )}

          {/* Play Button Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none z-10">
            <div className="w-12 h-12 rounded-full bg-bhutan-yellow flex items-center justify-center">
              <Play className="w-6 h-6 text-black ml-1" />
            </div>
          </div>

          {/* Badge */}
          {course.is_featured && (
            <Badge className="absolute top-3 right-3 bg-bhutan-yellow text-black z-20">
              Featured
            </Badge>
          )}
        </div>

        <CardContent className="space-y-3 p-4">
          {/* Course Title and Category */}
          <div className="space-y-1.5">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight transition-colors group-hover:text-bhutan-orange sm:text-base">
              {course.title}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-medium capitalize">
                {course.category}
              </Badge>
              <Badge className={`text-[10px] font-medium capitalize ${getLevelColor(course.level)}`}>
                {course.level}
              </Badge>
            </div>
          </div>

          {/* Course Stats */}
          <div className="flex items-center justify-between border-y py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{(course as any).students_count || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{(course as any).rating || 'New'}</span>
            </div>
          </div>

          {/* Progress Bar for Enrolled Courses */}
          {isEnrolled && progress > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-muted-foreground">{progress}% complete</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {/* Continue or Enroll Button */}
          <Button
            className={`h-9 w-full rounded-full text-sm font-medium ${
              isEnrolled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-bhutan-yellow text-black hover:bg-bhutan-orange'
            }`}
          >
            {isEnrolled ? 'Continue learning' : 'Enroll now'}
          </Button>
        </CardContent>
      </Card>
      </HoverCardTrigger>

      <HoverCardContent className="w-80 p-4" side="right" sideOffset={10}>
        <div className="space-y-3">
          {/* Course Title */}
          <div>
            <h4 className="font-semibold text-sm mb-1">{course.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {course.description || 'No description available.'}
            </p>
          </div>

          {/* Course Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{duration}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span>{(course as any).students_count || 0} students</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>{(course as any).rating || 'New'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3 h-3 text-muted-foreground" />
              <span>{course.modules?.length || 0} modules</span>
            </div>
          </div>

          {/* Level and Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {course.category}
            </Badge>
            <Badge className={`text-xs ${getLevelColor(course.level)}`}>
              {course.level}
            </Badge>
            {course.is_featured && (
              <Badge className="text-xs bg-bhutan-yellow text-black">
                <Award className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>

          {/* Instructor Info */}
          {(course as any).instructor_name && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-bhutan-yellow/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-bhutan-yellow">
                    {(course as any).instructor_name?.[0]?.toUpperCase() || 'I'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {(course as any).instructor_name}
                </span>
              </div>
            </div>
          )}

          {/* Learning Outcome */}
          {course.learning_outcomes && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-3 h-3 text-bhutan-yellow mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium mb-1">What you'll learn:</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {course.learning_outcomes}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}