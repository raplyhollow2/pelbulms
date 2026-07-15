'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Check,
  Clock,
  Calendar,
  Globe,
  Award,
  TrendingUp,
  BookOpen,
  Users,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CourseOverviewProps {
  course: {
    title: string
    description: string
    category: string
    level: string
    language: string
    duration_minutes: number
    last_updated: string
    requirements?: string[]
    learningObjectives?: string[]
    targetAudience?: string[]
    instructor?: {
      full_name: string
      bio?: string
      avatar_url?: string
    }
  }
}

export function CourseOverview({ course }: CourseOverviewProps) {
  const [showFullDescription, setShowFullDescription] = useState(false)

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    }
    return `${remainingMinutes}m`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner': return 'bg-green-500/20 text-green-700 border-green-500/30'
      case 'intermediate': return 'bg-blue-500/20 text-blue-700 border-blue-500/30'
      case 'advanced': return 'bg-purple-500/20 text-purple-700 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-700 border-gray-500/30'
    }
  }

  const truncateText = (text: string, words: number) => {
    const wordList = text.split(' ')
    if (wordList.length <= words) return text
    return wordList.slice(0, words).join(' ') + '...'
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass p-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-bhutan-yellow" />
              <div>
                <p className="text-xs text-muted-foreground">Level</p>
                <Badge className={cn("text-xs mt-1", getLevelColor(course.level))}>
                  {course.level}
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="glass p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-bhutan-orange" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold mt-1">{formatDuration(course.duration_minutes || 0)}</p>
              </div>
            </div>
          </Card>

          <Card className="glass p-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-bhutan-red" />
              <div>
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-sm font-semibold mt-1">{formatDate(course.last_updated)}</p>
              </div>
            </div>
          </Card>

          <Card className="glass p-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Language</p>
                <p className="text-sm font-semibold mt-1">{course.language}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* What You'll Learn - Large Card */}
          <Card className="glass-strong md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-bhutan-yellow" />
                What You'll Learn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {(course.learningObjectives || [
                  "Build modern web applications with Next.js",
                  "Master Server and Client Components",
                  "Implement advanced routing patterns",
                  "Optimize application performance",
                  "Deploy to production with confidence"
                ]).map((objective, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{objective}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Requirements & Prerequisites */}
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-bhutan-orange" />
                Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(course.requirements || [
                  "Basic JavaScript knowledge",
                  "Understanding of HTML and CSS",
                  "Node.js installed on your machine",
                  "Familiarity with terminal/command line"
                ]).map((requirement, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                    <span className="text-sm">{requirement}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Course Description with Read More */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-bhutan-red" />
              Course Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className={cn(
                "text-sm leading-relaxed transition-all duration-300",
                !showFullDescription && "line-clamp-3"
              )}>
                {course.description || "Master Next.js and build production-ready applications. Learn Server Components, advanced routing, performance optimization, and deployment strategies."}
              </p>

              {(course.description?.length > 200 || true) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-bhutan-yellow hover:text-bhutan-orange"
                >
                  {showFullDescription ? (
                    <>
                      Show Less <ChevronUp className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Show More <ChevronDown className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Target Audience */}
        {(course.targetAudience && course.targetAudience.length > 0) && (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Who This Course Is For
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {course.targetAudience.map((audience, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                    <span className="text-sm">{audience}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructor Info */}
        {course.instructor && (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Your Instructor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                {course.instructor.avatar_url && (
                  <img
                    src={course.instructor.avatar_url}
                    alt={course.instructor.full_name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{course.instructor.full_name}</h3>
                  {course.instructor.bio && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {truncateText(course.instructor.bio, 20)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  )
}