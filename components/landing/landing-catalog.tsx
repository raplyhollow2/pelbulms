'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'

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

function CourseCard({ course }: { course: LandingCourse }) {
  const thumb = resolveMediaUrl(course.thumbnail_url)
  const showRating = course.rating_count > 0 && course.average_rating > 0
  return (
    <Link href={`/courses/${course.id}`} className="w-64 shrink-0 snap-start">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-neutral-200">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-bhutan-yellow/30 to-bhutan-orange/20">
            <BookOpen className="h-8 w-8 text-bhutan-orange/70" />
          </div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-bold tracking-tight">{course.title}</h3>
      {course.instructor_name ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{course.instructor_name}</p>
      ) : null}
      {showRating ? (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold">
          <span>{course.average_rating.toFixed(1)}</span>
          <Star className="h-3.5 w-3.5 fill-bhutan-yellow text-bhutan-yellow" />
          <span className="font-normal text-muted-foreground">
            ({course.rating_count.toLocaleString()})
          </span>
        </p>
      ) : null}
    </Link>
  )
}

export function LandingCatalog({
  courses,
  featured,
}: {
  courses: LandingCourse[]
  featured: LandingCourse[]
}) {
  const categories = useMemo(() => {
    const grouped = new Map<string, LandingCourse[]>()
    for (const course of courses) {
      const name = course.category.trim()
      if (!name) continue
      const key = name.toLowerCase()
      const existing = grouped.get(key)
      if (existing) existing.push(course)
      else grouped.set(key, [course])
    }
    return [...grouped.entries()].map(([, items]) => ({
      name: items[0].category.trim(),
      thumbnail_url: items.find((item) => item.thumbnail_url)?.thumbnail_url || null,
      courses: items,
    }))
  }, [courses])
  const [tab, setTab] = useState(categories[0]?.name || '')
  const active = categories.find((category) => category.name === tab) || categories[0]
  const categoryRow = useRef<HTMLDivElement>(null)
  const featuredRow = useRef<HTMLDivElement>(null)

  function scrollRow(row: HTMLDivElement | null, direction: number) {
    row?.scrollBy({ left: direction * 300, behavior: 'smooth' })
  }

  if (!categories.length && !featured.length) return null

  return (
    <div>
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">Learn by category</h2>
            <div className="hidden gap-2 lg:flex">
              <button
                type="button"
                aria-label="Previous categories"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
                onClick={() => scrollRow(categoryRow.current, -1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next categories"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
                onClick={() => scrollRow(categoryRow.current, 1)}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div
            ref={categoryRow}
            className="-mx-5 mt-4 flex gap-4 overflow-x-auto px-5 pb-2 snap-x snap-mandatory lg:mx-0 lg:px-0"
          >
            {categories.map((category) => {
              const thumb = resolveMediaUrl(category.thumbnail_url)
              return (
                <Link
                  key={category.name}
                  href={categoryHref(category.name)}
                  className="w-64 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-background"
                >
                  <div className="relative h-40 bg-neutral-200">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-bhutan-yellow/30 to-bhutan-orange/20">
                        <BookOpen className="h-8 w-8 text-bhutan-orange/70" />
                      </div>
                    )}
                  </div>
                  <span className="flex items-center justify-between px-3 py-3 text-sm font-bold">
                    {category.name}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">Courses to start with</h2>
            <button
              type="button"
              aria-label="Next courses"
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-background lg:flex"
              onClick={() => scrollRow(featuredRow.current, 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div
            ref={featuredRow}
            className="-mx-5 mt-4 flex gap-4 overflow-x-auto px-5 pb-2 snap-x snap-mandatory lg:mx-0 lg:px-0"
          >
            {featured.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {active && (
        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="text-2xl font-bold tracking-tight">Skills to start with</h2>
          <div className="mt-4 flex gap-4 overflow-x-auto border-b border-border">
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                className={`shrink-0 border-b-2 pb-2 text-sm font-semibold ${
                  category.name === active.name
                    ? 'border-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
                onClick={() => setTab(category.name)}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="-mx-5 mt-4 flex gap-4 overflow-x-auto px-5 pb-2 snap-x snap-mandatory lg:mx-0 lg:px-0">
            {active.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          <Link
            href={categoryHref(active.name)}
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-bhutan-orange"
          >
            Show all {active.name} courses
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </div>
  )
}
