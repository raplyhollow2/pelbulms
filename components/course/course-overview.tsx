'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Clock, Calendar, Globe, Award, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'
import { LinkedInProfileLink } from '@/components/profile/linkedin-profile-link'
import { linkedinFromProfile } from '@/lib/social-links'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']

export type InstructorInfo = {
  id?: string
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  social_links?: unknown
  staffRole?: string
}

interface CourseOverviewProps {
  course: Course
  instructor?: InstructorInfo | null
  instructors?: InstructorInfo[]
  moduleDescription?: string | null
}

function staffRoleLabel(role?: string) {
  if (!role || role === 'owner') return 'Lead'
  return role.replace(/_/g, ' ')
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function CourseOverview({
  course,
  instructor,
  instructors,
  moduleDescription,
}: CourseOverviewProps) {
  const [expanded, setExpanded] = useState(false)

  const whatYouLearn = Array.isArray((course as any).learning_objectives)
    ? ((course as any).learning_objectives as string[]).filter(Boolean)
    : []
  const requirements = Array.isArray((course as any).requirements)
    ? ((course as any).requirements as string[]).filter(Boolean)
    : Array.isArray((course as any).prerequisites)
      ? ((course as any).prerequisites as string[]).filter(Boolean)
      : []

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const people: InstructorInfo[] =
    instructors && instructors.length > 0
      ? instructors
      : [instructor || { full_name: 'Instructor' }]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-bhutan-yellow" />
              What You&apos;ll Learn
            </CardTitle>
          </CardHeader>
          <CardContent>
            {whatYouLearn.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {whatYouLearn.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Learning objectives have not been added for this course yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            {requirements.length > 0 ? (
              <ul className="space-y-2">
                {requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-bhutan-yellow font-bold">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No specific requirements listed.</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-bhutan-orange" />
              Course Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            {moduleDescription && (
              <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Module overview</p>
                <p className="text-sm">{moduleDescription}</p>
              </div>
            )}
            <div
              className={`text-sm text-muted-foreground transition-all duration-300 ${
                expanded ? 'max-h-full' : 'max-h-32 overflow-hidden'
              }`}
            >
              <p className="whitespace-pre-wrap">
                {course.description || 'No description provided for this course.'}
              </p>
            </div>
            {(course.description?.length || 0) > 280 && (
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
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Level</span>
              </div>
              <Badge variant="secondary" className="capitalize">
                {course.level}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Duration</span>
              </div>
              <span className="text-sm font-medium">
                {course.duration_minutes ? formatDuration(course.duration_minutes) : 'Self-paced'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Updated</span>
              </div>
              <span className="text-sm font-medium">
                {course.updated_at ? formatDate(course.updated_at) : 'Recent'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Language</span>
              </div>
              <Badge variant="outline">{(course as any).language || 'English'}</Badge>
            </div>

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

      <Card className="glass">
        <CardHeader>
          <CardTitle>{people.length > 1 ? 'Instructors' : 'Instructor'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {people.map((person, index) => {
            const instructorName = person.full_name?.trim() || 'Instructor'
            const instructorLinkedIn = linkedinFromProfile(person)
            const avatarUrl = resolveMediaUrl(person.avatar_url)
            const profileHref = person.id ? `/instructors/${person.id}` : null
            return (
              <div key={person.id || index} className="flex items-start gap-4">
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="w-16 h-16 shrink-0 overflow-hidden rounded-full"
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={instructorName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-bhutan-yellow text-xl font-bold text-black">
                        {initialsFor(instructorName) || 'IN'}
                      </div>
                    )}
                  </Link>
                ) : avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={instructorName}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bhutan-yellow text-xl font-bold text-black">
                    {initialsFor(instructorName) || 'IN'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {profileHref ? (
                      <Link href={profileHref} className="font-semibold text-lg hover:text-bhutan-orange">
                        {instructorName}
                      </Link>
                    ) : (
                      <h3 className="font-semibold text-lg">{instructorName}</h3>
                    )}
                    {people.length > 1 && person.staffRole && (
                      <Badge variant={person.staffRole === 'owner' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                        {staffRoleLabel(person.staffRole)}
                      </Badge>
                    )}
                  </div>
                  {person.bio ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{person.bio}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Course instructor</p>
                  )}
                  {instructorLinkedIn && (
                    <div className="mt-2">
                      <LinkedInProfileLink url={instructorLinkedIn} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
