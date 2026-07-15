'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Clock, Calendar, Globe, Award, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']

interface CourseOverviewProps {
  course: Course
}

export function CourseOverview({ course }: CourseOverviewProps) {
  const [expanded, setExpanded] = useState(false)

  const whatYouLearn = [
    "Server Components vs Client Components architecture",
    "Advanced Layout Patterns with App Router",
    "Server Actions and mutations",
    "Performance optimization techniques",
    "Authentication with Supabase",
    "Database design and management",
    "API routes and serverless functions",
    "Deployment strategies for Next.js applications"
  ]

  const requirements = [
    "Basic knowledge of JavaScript and React",
    "Familiarity with HTML and CSS",
    "Understanding of web development concepts",
    "Node.js installed on your machine",
    "Basic Git knowledge"
  ]

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* What You'll Learn Card */}
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-bhutan-yellow" />
              What You'll Learn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {whatYouLearn.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Requirements Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {requirements.map((req, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-bhutan-yellow font-bold">•</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Course Description Card */}
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-bhutan-orange" />
              Course Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-sm text-muted-foreground transition-all duration-300 ${
                expanded ? 'max-h-full' : 'max-h-32 overflow-hidden'
              }`}
            >
              <p>{course.description}</p>
              <p className="mt-4">
                This comprehensive course takes you from beginner to advanced in Next.js development.
                You'll build real-world projects and learn best practices for modern web development.
                The course covers everything from basic routing to advanced optimization techniques,
                ensuring you have the skills to build production-ready applications.
              </p>
              {expanded && (
                <>
                  <p className="mt-4">
                    Throughout the course, you'll work on hands-on projects that reinforce your learning
                    and help you build a portfolio of work to showcase to potential employers. Each module
                    is designed to build upon the previous ones, creating a comprehensive understanding of
                    Next.js and modern web development.
                  </p>
                  <p className="mt-4">
                    By the end of this course, you'll have the confidence and skills to tackle any
                    Next.js project and build scalable, performant web applications.
                  </p>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="mt-4 text-bhutan-yellow hover:text-bhutan-orange"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Read More
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Level */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Level</span>
              </div>
              <Badge variant="secondary" className="capitalize">
                {course.level}
              </Badge>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Duration</span>
              </div>
              <span className="text-sm font-medium">
                {course.duration_minutes ? formatDuration(course.duration_minutes) : 'Self-paced'}
              </span>
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Updated</span>
              </div>
              <span className="text-sm font-medium">
                {course.updated_at ? formatDate(course.updated_at) : 'Recent'}
              </span>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Language</span>
              </div>
              <Badge variant="outline">English</Badge>
            </div>

            {/* Category */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Category</span>
              </div>
              <Badge variant="outline" className="capitalize">
                {course.category}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructor Section */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Instructor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-bhutan-yellow flex items-center justify-center text-black font-bold text-xl">
              RP
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Rajiv Pradhan</h3>
              <p className="text-sm text-muted-foreground mb-2">Senior Next.js Developer & Instructor</p>
              <p className="text-sm">
                Passionate about teaching modern web development and helping students build
                production-ready applications with Next.js and React.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}