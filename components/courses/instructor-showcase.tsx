'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  BookOpen,
  Users,
  Star,
  Award,
  TrendingUp,
  Calendar,
  MapPin,
  Link,
  GitBranch,
  Globe,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media'
import Link from 'next/link'

interface Instructor {
  id: string
  full_name: string
  avatar_url?: string
  bio?: string
  expertise?: string[]
  rating?: number
  students_count?: number
  courses_count?: number
  years_experience?: number
  location?: string
  website?: string
  social_links?: {
    linkedin?: string
    github?: string
    website?: string
  }
  achievements?: string[]
}

interface InstructorShowcaseProps {
  instructors: Instructor[]
  layout?: 'grid' | 'masonry' | 'spotlight'
  maxShow?: number
  viewAllHref?: string
}

export function InstructorShowcase({
  instructors,
  layout = 'grid',
  maxShow = 6,
  viewAllHref = '/instructors',
}: InstructorShowcaseProps) {
  const [featuredInstructor, setFeaturedInstructor] = useState<Instructor | null>(
    instructors[0] || null
  )
  const displayedInstructors = instructors.slice(0, maxShow)

  if (displayedInstructors.length === 0) {
    return null
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const SocialLink = ({
    platform,
    url,
  }: {
    platform: 'linkedin' | 'github' | 'website'
    url?: string
  }) => {
    if (!url) return null

    const icons = {
      linkedin: <Link className="w-4 h-4" />,
      github: <GitBranch className="w-4 h-4" />,
      website: <Globe className="w-4 h-4" />,
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
      >
        {icons[platform]}
      </a>
    )
  }

  if (layout === 'spotlight') {
    return (
      <div className="space-y-8">
        {/* Featured Instructor */}
        {featuredInstructor && (
          <Card className="glass-strong border-2 border-bhutan-yellow/30 overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Image & Basic Info */}
                <div className="bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20 p-8 flex flex-col items-center justify-center text-center">
                  <Avatar className="w-32 h-32 mb-4 border-4 border-bhutan-yellow">
                    <AvatarImage src={resolveMediaUrl(featuredInstructor.avatar_url) || undefined} />
                    <AvatarFallback className="bg-bhutan-yellow text-black text-2xl font-bold">
                      {getInitials(featuredInstructor.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-2xl font-bold mb-2">{featuredInstructor.full_name}</h3>
                  {featuredInstructor.bio && (
                    <p className="text-muted-foreground mb-4">{featuredInstructor.bio}</p>
                  )}

                  {/* Social Links */}
                  <div className="flex items-center gap-2 mb-4">
                    <SocialLink platform="linkedin" url={featuredInstructor.social_links?.linkedin} />
                    <SocialLink platform="github" url={featuredInstructor.social_links?.github} />
                    <SocialLink platform="website" url={featuredInstructor.website} />
                  </div>

                  <Button
                    className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                    onClick={() => window.location.href = `/instructors/${featuredInstructor.id}`}
                  >
                    View Profile
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {/* Stats & Details */}
                <div className="p-8 space-y-6">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-bhutan-yellow mb-1">
                        <Star className="w-5 h-5 fill-current" />
                        <span className="text-2xl font-bold">
                          {featuredInstructor.rating != null ? featuredInstructor.rating : 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-bhutan-yellow mb-1">
                        <Users className="w-5 h-5" />
                        <span className="text-2xl font-bold">
                          {featuredInstructor.students_count?.toLocaleString() || '0'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-bhutan-yellow mb-1">
                        <BookOpen className="w-5 h-5" />
                        <span className="text-2xl font-bold">
                          {featuredInstructor.courses_count || '0'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Courses</p>
                    </div>
                  </div>

                  {/* Expertise */}
                  {featuredInstructor.expertise && featuredInstructor.expertise.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-bhutan-yellow" />
                        Expertise
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {featuredInstructor.expertise.map((skill, idx) => (
                          <Badge key={idx} variant="outline">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Achievements */}
                  {featuredInstructor.achievements && featuredInstructor.achievements.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-bhutan-yellow" />
                        Achievements
                      </h4>
                      <ul className="space-y-2">
                        {featuredInstructor.achievements.map((achievement, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-bhutan-yellow mt-1.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{achievement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Location & Experience */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {featuredInstructor.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{featuredInstructor.location}</span>
                      </div>
                    )}
                    {featuredInstructor.years_experience && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{featuredInstructor.years_experience} years experience</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other Instructors Grid */}
        <div>
          <h3 className="text-2xl font-bold mb-4">More Expert Instructors</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedInstructors.slice(1).map((instructor) => (
              <Card
                key={instructor.id}
                className="glass hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => setFeaturedInstructor(instructor)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-12 h-12 border-2 border-bhutan-yellow/30">
                      <AvatarImage src={instructor.avatar_url} />
                      <AvatarFallback className="bg-bhutan-yellow/20 text-black font-bold">
                        {getInitials(instructor.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{instructor.full_name}</h4>
                      {instructor.expertise && instructor.expertise.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {instructor.expertise[0]}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-bhutan-yellow transition-colors" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{instructor.rating || 'New'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{instructor.students_count?.toLocaleString() || '0'} students</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      <span>{instructor.courses_count || '0'} courses</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Default Grid Layout — portrait 2:3 cards
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Expert instructors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Learn from verified educators across Bhutan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {displayedInstructors.map((instructor) => (
          <Link key={instructor.id} href={`/instructors/${instructor.id}`} className="block">
            <Card className="glass hover-lift overflow-hidden p-0 h-full">
              <CardContent className="flex h-full flex-col p-0">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-bhutan-yellow/25 to-bhutan-orange/20">
                  {instructor.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMediaUrl(instructor.avatar_url) || instructor.avatar_url}
                      alt={instructor.full_name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Avatar className="h-20 w-20 border-2 border-bhutan-yellow/40 sm:h-24 sm:w-24">
                        <AvatarFallback className="bg-bhutan-yellow/30 text-lg font-semibold text-bhutan-orange sm:text-xl">
                          {getInitials(instructor.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-10">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                      {instructor.full_name}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-white/80">
                      {instructor.expertise?.filter((e) => e !== 'Instructor')[0] ||
                        (instructor.courses_count
                          ? `${instructor.courses_count} course${instructor.courses_count === 1 ? '' : 's'}`
                          : 'Instructor')}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/70">
                      <span className="inline-flex items-center gap-0.5">
                        <BookOpen className="h-3 w-3" />
                        {instructor.courses_count || 0}
                      </span>
                      {instructor.rating != null && (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {instructor.rating}
                        </span>
                      )}
                      {(instructor.students_count || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {instructor.students_count?.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}