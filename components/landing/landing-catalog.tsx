'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/media'
import { LandingSection } from '@/components/landing/landing-section'

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

const pairCardClass =
  'w-[calc((100%-1rem)/2)] shrink-0 snap-start rounded-xl bg-background p-2 shadow-md md:w-64'
const rowClass = 'mt-4 flex w-full min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-0.5 py-2'

function CardThumbnail({ url }: { url: string | null }) {
  const thumb = resolveMediaUrl(url)
  return (
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
  )
}

function FeaturedCourseCard({ course }: { course: LandingCourse }) {
  const showRating = course.rating_count > 0 && course.average_rating > 0
  return (
    <Link
      href={`/courses/${course.id}`}
      className="block rounded-xl border border-border bg-background p-3 shadow-sm"
    >
      <CardThumbnail url={course.thumbnail_url} />
      <h3 className="mt-3 line-clamp-2 text-base font-bold leading-snug tracking-tight">{course.title}</h3>
      {course.instructor_name ? (
        <p className="mt-1 truncate text-sm text-muted-foreground">{course.instructor_name}</p>
      ) : null}
      {showRating ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-semibold">
            <Star className="h-3.5 w-3.5 fill-bhutan-yellow text-bhutan-yellow" />
            {course.average_rating.toFixed(1)}
          </span>
          <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
            {course.rating_count.toLocaleString()} {course.rating_count === 1 ? 'rating' : 'ratings'}
          </span>
        </p>
      ) : null}
    </Link>
  )
}

function CourseCard({ course }: { course: LandingCourse }) {
  const showRating = course.rating_count > 0 && course.average_rating > 0
  return (
    <Link href={`/courses/${course.id}`} className={pairCardClass}>
      <CardThumbnail url={course.thumbnail_url} />
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
  const [categoryScroll, setCategoryScroll] = useState({ left: false, right: false })

  useEffect(() => {
    const row = categoryRow.current
    if (!row) return
    const update = () => {
      const max = row.scrollWidth - row.clientWidth
      setCategoryScroll({
        left: row.scrollLeft > 4,
        right: max > 4 && row.scrollLeft < max - 4,
      })
    }
    update()
    row.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(row)
    return () => {
      row.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [categories.length])

  function scrollRow(row: HTMLDivElement | null, direction: number) {
    if (!row) return
    const card = row.firstElementChild as HTMLElement | null
    const styles = getComputedStyle(row)
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0
    const distance = card ? card.offsetWidth + gap : row.clientWidth
    row.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }

  if (!categories.length && !featured.length) return null

  return (
    <div className="min-w-0">
      {categories.length > 0 && (
        <LandingSection>
          <h2 className="text-2xl font-bold tracking-tight">Learn by category</h2>
          <div className="relative">
          <div ref={categoryRow} className={rowClass}>
            {categories.map((category) => (
              <Link key={category.name} href={categoryHref(category.name)} className={pairCardClass}>
                <CardThumbnail url={category.thumbnail_url} />
                <span className="mt-2 flex items-center justify-between gap-2 text-sm font-bold tracking-tight">
                  <span className="truncate">{category.name}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </span>
              </Link>
            ))}
          </div>
          {categoryScroll.left ? (
            <button
              type="button"
              aria-label="Previous categories"
              className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
              onClick={() => scrollRow(categoryRow.current, -1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          {categoryScroll.right ? (
            <button
              type="button"
              aria-label="Next categories"
              className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
              onClick={() => scrollRow(categoryRow.current, 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
          </div>
        </LandingSection>
      )}

      {active && (
        <LandingSection>
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
          <div className={rowClass}>
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
        </LandingSection>
      )}

      {featured.length > 0 && (
        <LandingSection>
          <h2 className="text-2xl font-bold tracking-tight">Courses to start with</h2>
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
            {featured.map((course) => (
              <FeaturedCourseCard key={course.id} course={course} />
            ))}
          </div>
        </LandingSection>
      )}
    </div>
  )
}
