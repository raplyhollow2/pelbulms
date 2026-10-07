'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import Link from 'next/link'
import { ArrowRight, BookOpen, Star } from 'lucide-react'
import { cloudinaryDisplayUrl, resolveMediaUrl } from '@/lib/media'
import { LandingSection } from '@/components/landing/landing-section'
import { cn } from '@/lib/utils'

export type LandingCourse = {
  id: string
  title: string
  category: string
  thumbnail_url: string | null
  average_rating: number
  rating_count: number
  instructor_name: string | null
}

function categoryHref(category: string) {
  return `/courses?category=${encodeURIComponent(category)}`
}

const tile =
  'group gap-0 overflow-hidden border-0 p-0 py-0 shadow-sm ring-1 ring-foreground/10 [--card-spacing:0] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg'

function enter(delay: number) {
  return {
    className: 'animate-in fade-in slide-in-from-bottom-4 duration-700',
    style: { animationDelay: `${delay}ms`, animationFillMode: 'both' as const },
  }
}

function Cover({ url, className }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  const thumb = failed ? '/covers/business-models.jpg' : resolveMediaUrl(url)
  if (!thumb) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <BookOpen className="h-8 w-8 text-primary" />
      </div>
    )
  }
  const sized = (width: number) => (thumb.startsWith('/') ? thumb : cloudinaryDisplayUrl(thumb, width))
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sized(840)}
      srcSet={
        thumb.startsWith('/')
          ? undefined
          : `${sized(480)} 480w, ${sized(840)} 840w, ${sized(1200)} 1200w`
      }
      sizes="(min-width: 768px) 60vw, 100vw"
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-cover transition-transform duration-700 ease-out group-hover:scale-105', className)}
    />
  )
}

function Rating({ course, light = false }: { course: LandingCourse; light?: boolean }) {
  if (course.rating_count <= 0 || course.average_rating <= 0) return null
  return (
    <p className={cn('mt-2 flex items-center gap-1 text-xs font-semibold', light ? 'text-white/90' : 'text-foreground')}>
      <Star className={cn('h-3.5 w-3.5', light ? 'fill-white text-white' : 'fill-primary text-primary')} />
      {course.average_rating.toFixed(1)}
      <span className={light ? 'font-normal text-white/70' : 'font-normal text-muted-foreground'}>
        ({course.rating_count.toLocaleString()})
      </span>
    </p>
  )
}

function LeadCourse({ course, delay }: { course: LandingCourse; delay: number }) {
  const motion = enter(delay)
  return (
    <Card className={cn(tile, 'relative min-h-80 md:col-span-7 md:row-span-2 md:min-h-[28rem]', motion.className)} style={motion.style}>
      <Link href={`/courses/${course.id}`} className="relative flex h-full min-h-80 flex-col justify-end md:min-h-[28rem]">
        <Cover url={course.thumbnail_url} className="absolute inset-0 h-full w-full" />
        <div className="relative bg-gradient-to-t from-black/80 via-black/45 to-transparent p-5 text-white sm:p-6">
          {course.category ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-white/75">{course.category}</p>
          ) : null}
          <h3 className="mt-2 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h3>
          {course.instructor_name ? (
            <p className="mt-1 text-sm text-white/80">{course.instructor_name}</p>
          ) : null}
          <Rating course={course} light />
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
            Open course
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </Card>
  )
}

function SideCourse({ course, delay }: { course: LandingCourse; delay: number }) {
  const motion = enter(delay)
  return (
    <Card className={cn(tile, 'md:col-span-5', motion.className)} style={motion.style}>
      <Link href={`/courses/${course.id}`} className="flex h-full flex-col">
        <Cover url={course.thumbnail_url} className="aspect-[16/8] w-full" />
        <div className="flex flex-1 flex-col p-4">
          {course.category ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{course.category}</p>
          ) : null}
          <h3 className="mt-1 line-clamp-2 text-base font-bold tracking-tight transition-colors group-hover:text-primary">
            {course.title}
          </h3>
          {course.instructor_name ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">{course.instructor_name}</p>
          ) : null}
          <Rating course={course} />
        </div>
      </Link>
    </Card>
  )
}

function Topics({
  categories,
  delay,
  tall,
}: {
  categories: { name: string; count: number }[]
  delay: number
  tall: boolean
}) {
  const motion = enter(delay)
  const shown = categories.slice(0, 6)
  return (
    <Card className={cn(tile, 'md:col-span-5', tall && 'md:row-span-2', motion.className)} style={motion.style}>
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold tracking-tight">Topics</h3>
          <Button variant="link" className="h-auto px-0" render={<Link href="/courses" />}>
            All courses
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <ul className="mt-3 grid gap-1">
          {shown.map((category, index) => (
            <li
              key={category.name}
              className="animate-in fade-in slide-in-from-left-2 duration-500"
              style={{ animationDelay: `${delay + 120 + index * 50}ms`, animationFillMode: 'both' }}
            >
              <Link
                href={categoryHref(category.name)}
                className="group/topic flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
              >
                <span className="truncate font-medium transition-colors group-hover/topic:text-primary">{category.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {category.count}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/topic:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

export function LandingCatalog({
  courses,
  featured,
}: {
  courses: LandingCourse[]
  featured: LandingCourse[]
}) {
  const categories = (() => {
    const grouped = new Map<string, number>()
    const names = new Map<string, string>()
    for (const course of courses) {
      const name = course.category.trim()
      if (!name) continue
      const key = name.toLowerCase()
      names.set(key, name)
      grouped.set(key, (grouped.get(key) || 0) + 1)
    }
    return [...grouped.entries()].map(([key, count]) => ({
      name: names.get(key) || key,
      count,
    }))
  })()

  const spotlight: LandingCourse[] = []
  const seen = new Set<string>()
  for (const course of [...featured, ...courses]) {
    if (seen.has(course.id)) continue
    seen.add(course.id)
    spotlight.push(course)
    if (spotlight.length === 2) break
  }

  const [lead, side] = spotlight
  if (!lead && categories.length === 0) return null

  return (
    <LandingSection>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Courses</h2>
          <p className="mt-1 text-sm text-muted-foreground">Open a class, or browse by topic.</p>
        </div>
        <Button variant="outline" render={<Link href="/courses" />}>
          Browse all courses
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-12">
        {lead ? <LeadCourse course={lead} delay={0} /> : null}
        {side ? <SideCourse course={side} delay={90} /> : null}
        {categories.length > 0 ? (
          <Topics categories={categories} delay={side ? 160 : 90} tall={!side && Boolean(lead)} />
        ) : null}
      </div>
    </LandingSection>
  )
}
