'use client'
import { Input } from '@/components/ui/input'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogIn, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand/brand-logo'
import type { LandingCourse } from '@/components/landing/landing-catalog'

export function LandingNav({
  courses,
  glassOpacity = 70,
  logoUrl,
}: {
  courses: LandingCourse[]
  glassOpacity?: number
  logoUrl?: string | null
}) {
  const router = useRouter()
  const rootRef = useRef<HTMLElement>(null)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const categories = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const course of courses) {
      const name = course.category.trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      names.push(name)
    }
    return names
  }, [courses])
  const [activeCategory, setActiveCategory] = useState(categories[0] || '')
  const sideCourses = courses.filter(
    (course) => course.category.toLowerCase() === activeCategory.toLowerCase()
  )
  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const pool = needle
      ? courses.filter((course) => course.title.toLowerCase().includes(needle))
      : courses
    return pool.slice(0, 6)
  }, [courses, query])

  useEffect(() => {
    if (!exploreOpen && !searchOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExploreOpen(false)
        setSearchOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExploreOpen(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [exploreOpen, searchOpen])

  function goToSearch(value: string) {
    const q = value.trim()
    router.push(q ? `/courses?q=${encodeURIComponent(q)}` : '/courses')
  }

  const veil = Math.min(90, Math.max(20, Math.round(glassOpacity))) / 100

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-50 w-full shrink-0 overflow-visible safe-area-top"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 border-b border-border shadow-sm backdrop-blur-xl"
        style={{ backgroundColor: `color-mix(in oklch, var(--background) ${Math.round(veil * 100)}%, transparent)` }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center gap-2 overflow-visible px-4 py-2.5 sm:gap-3 sm:px-5">
        <BrandLogo href="/" src={logoUrl} height={32} markBelow400 className="shrink-0" />

        {categories.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            aria-expanded={exploreOpen}
            onClick={() => {
              setExploreOpen((open) => !open)
              setSearchOpen(false)
              setActiveCategory(categories[0] || '')
            }}
          >
            Explore
          </Button>
        )}

        <form
          className="relative min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            setSearchOpen(false)
            goToSearch(query)
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSearchOpen(true)
              setExploreOpen(false)
            }}
            onFocus={() => {
              setSearchOpen(true)
              setExploreOpen(false)
            }}
            placeholder="Search for anything"
            aria-label="Search courses"
            className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm outline-none ring-primary/30 focus:ring-2"
          />
          {searchOpen && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
              {suggestions.map((course) => (
                <li key={course.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-md px-3 py-2 text-left text-sm font-normal"
                    onClick={() => {
                      setSearchOpen(false)
                      goToSearch(course.title)
                    }}
                  >
                    {course.title}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <Link href="/teach/create" className="hidden shrink-0 text-sm font-medium hover:text-primary lg:inline">
          Teach
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="hidden shrink-0 rounded-md lg:inline-flex"
          render={<Link href="/auth/login" />}
        >
          Log in
        </Button>
        <Button
          size="sm"
          className="hidden shrink-0 rounded-md bg-primary font-bold text-primary-foreground hover:bg-primary/90 lg:inline-flex"
          render={<Link href="/auth/login" />}
        >
          Sign up
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full lg:hidden"
          render={<Link href="/auth/login" />}
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      </div>

      {exploreOpen && categories.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 border-b border-border bg-background shadow-lg">
          <div className="mx-auto grid max-w-6xl gap-0 sm:grid-cols-[16rem_minmax(0,1fr)]">
            <ul className="max-h-80 overflow-y-auto border-b border-border py-2 sm:border-b-0 sm:border-r">
              {categories.map((category) => (
                <li key={category}>
                  <Link
                    href={`/courses?category=${encodeURIComponent(category)}`}
                    className={`block px-4 py-2 text-sm hover:bg-muted ${
                      category === activeCategory ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                    onMouseEnter={() => setActiveCategory(category)}
                    onFocus={() => setActiveCategory(category)}
                  >
                    {category}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="max-h-80 overflow-y-auto py-2">
              {sideCourses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    className="block px-4 py-2 text-sm hover:bg-muted"
                  >
                    {course.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  )
}
