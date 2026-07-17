'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { BookOpen, Home, User, Settings, GraduationCap, Users, Bell, TrendingUp, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CourseHit {
  id: string
  title: string
  category: string | null
}

/** Fired by the sidebar / mobile menu to open the palette without a keyboard. */
export const OPEN_SEARCH_EVENT = 'pelbu:open-search'

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [courses, setCourses] = useState<CourseHit[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadCourses = useCallback(async () => {
    if (loaded || loading) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('courses')
        .select('id, title, category')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(50)
      setCourses((data as any) || [])
      setLoaded(true)
    } catch (err) {
      console.error('Course search load error:', err)
    } finally {
      setLoading(false)
    }
  }, [loaded, loading])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const openViaEvent = () => setOpen(true)

    document.addEventListener('keydown', down)
    window.addEventListener(OPEN_SEARCH_EVENT, openViaEvent)
    return () => {
      document.removeEventListener('keydown', down)
      window.removeEventListener(OPEN_SEARCH_EVENT, openViaEvent)
    }
  }, [])

  // Lazy-load live course data the first time the palette opens.
  useEffect(() => {
    if (open) loadCourses()
  }, [open, loadCourses])

  const runCommand = (command: string) => {
    setOpen(false)
    router.push(command)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-background/70 pt-[12vh] backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative mx-4 w-full max-w-lg animate-in slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-overlay">
          <Command shouldFilter>
            <CommandInput placeholder="Search courses or jump to a page…" />
            <CommandList>
              <CommandEmpty>
                {loading ? (
                  <span className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </span>
                ) : (
                  'No results found.'
                )}
              </CommandEmpty>

              {courses.length > 0 && (
                <CommandGroup heading="Courses">
                  {courses.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.title} ${c.category ?? ''}`}
                      onSelect={() => runCommand(`/courses/${c.id}`)}
                    >
                      <BookOpen className="mr-2 h-4 w-4 text-bhutan-orange" />
                      <span className="truncate">{c.title}</span>
                      {c.category && (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{c.category}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading="Navigation">
                <CommandItem value="dashboard home" onSelect={() => runCommand('/dashboard')}>
                  <Home className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </CommandItem>
                <CommandItem value="courses catalog browse" onSelect={() => runCommand('/courses')}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Browse courses</span>
                </CommandItem>
                <CommandItem value="progress learning" onSelect={() => runCommand('/learn/progress')}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  <span>My Progress</span>
                </CommandItem>
                <CommandItem value="announcements news" onSelect={() => runCommand('/announcements')}>
                  <Bell className="mr-2 h-4 w-4" />
                  <span>Announcements</span>
                </CommandItem>
                <CommandItem value="profile account" onSelect={() => runCommand('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </CommandItem>
                <CommandItem value="settings preferences" onSelect={() => runCommand('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Teaching & Admin">
                <CommandItem value="teacher dashboard" onSelect={() => runCommand('/teach/dashboard')}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  <span>Teacher Dashboard</span>
                </CommandItem>
                <CommandItem value="user management admin" onSelect={() => runCommand('/admin/users')}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>User Management</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </div>
    </div>
  )
}
