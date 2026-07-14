'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Search, BookOpen, GraduationCap, Home, User, Settings, Loader2, Clock, FileQuestion, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']

interface CommandItem {
  id: string
  title: string
  description?: string
  icon: any
  action: () => void
  category: string
  type: 'navigation' | 'course' | 'lesson' | 'action'
  metadata?: {
    progress?: number
    duration?: string
    category?: string
    level?: string
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<CommandItem[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch('')
      setResults(getDefaultCommands())
    }
  }, [open])

  // Search functionality
  const searchContent = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults(getDefaultCommands())
      return
    }

    setLoading(true)
    try {
      const commands = getDefaultCommands()
      const filteredCommands = commands.filter(cmd =>
        cmd.title.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase())
      )

      // Search courses if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Search enrolled courses
        const { data: courses } = await supabase
          .from('courses')
          .select('*, enrollments!inner(progress_percentage)')
          .eq('is_published', true)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.ilike.%${query}%`)
          .limit(5)

        if (courses) {
          const courseCommands: CommandItem[] = courses.map((course: any) => ({
            id: course.id,
            title: course.title,
            description: course.description,
            icon: BookOpen,
            action: () => {
              router.push(`/learn/${course.id}`)
              setOpen(false)
            },
            category: 'My Courses',
            type: 'course',
            metadata: {
              progress: course.enrollments?.[0]?.progress_percentage || 0,
              category: course.category,
              level: course.level
            }
          }))
          filteredCommands.push(...courseCommands)
        }

        // Search lessons
        const { data: lessons } = await supabase
          .from('lessons')
          .select('*, modules!inner(course_id)')
          .eq('is_published', true)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(5)

        if (lessons) {
          const lessonCommands: CommandItem[] = lessons.map((lesson: any) => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            icon: FileQuestion,
            action: () => {
              router.push(`/learn/${lesson.modules.course_id}/lesson/${lesson.id}`)
              setOpen(false)
            },
            category: 'Lessons',
            type: 'lesson',
            metadata: {
              duration: lesson.video_duration ? `${Math.floor(lesson.video_duration / 60)}m` : undefined
            }
          }))
          filteredCommands.push(...lessonCommands)
        }
      }

      setResults(filteredCommands)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContent(search)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [search, searchContent])

  const getDefaultCommands = (): CommandItem[] => [
    {
      id: 'dashboard',
      title: 'Go to Dashboard',
      icon: Home,
      action: () => {
        router.push('/dashboard')
        setOpen(false)
      },
      category: 'Navigation',
      type: 'navigation'
    },
    {
      id: 'courses',
      title: 'Browse Courses',
      icon: BookOpen,
      action: () => {
        router.push('/courses')
        setOpen(false)
      },
      category: 'Navigation',
      type: 'navigation'
    },
    {
      id: 'learn',
      title: 'My Learning',
      icon: GraduationCap,
      action: () => {
        router.push('/learn')
        setOpen(false)
      },
      category: 'Navigation',
      type: 'navigation'
    },
    {
      id: 'profile',
      title: 'Profile Settings',
      icon: User,
      action: () => {
        router.push('/profile')
        setOpen(false)
      },
      category: 'Navigation',
      type: 'navigation'
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: Settings,
      action: () => {
        router.push('/settings')
        setOpen(false)
      },
      category: 'Navigation',
      type: 'navigation'
    }
  ]

  const renderCommandItem = (item: CommandItem) => {
    const Icon = item.icon

    return (
      <button
        key={item.id}
        onClick={() => item.action()}
        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-bhutan-yellow/10 transition-colors text-left group"
      >
        <div className="w-10 h-10 rounded-lg bg-bhutan-yellow/20 flex items-center justify-center flex-shrink-0 group-hover:bg-bhutan-yellow/30 transition-colors">
          <Icon className="w-5 h-5 text-bhutan-yellow" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="font-medium text-sm truncate">{item.title}</div>
              {item.description && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.description}
                </div>
              )}
            </div>
            {item.metadata?.progress !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {item.metadata.progress}%
              </Badge>
            )}
            {item.metadata?.duration && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.metadata.duration}
              </Badge>
            )}
          </div>
          {(item.metadata?.category || item.metadata?.level) && (
            <div className="flex gap-1 mt-1">
              {item.metadata.category && (
                <Badge variant="secondary" className="text-xs">
                  {item.metadata.category}
                </Badge>
              )}
              {item.metadata.level && (
                <Badge variant="outline" className="text-xs capitalize">
                  {item.metadata.level}
                </Badge>
              )}
            </div>
          )}
        </div>
      </button>
    )
  }

  // Group results by category
  const groupedResults = results.reduce((groups, item) => {
    const category = item.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(item)
    return groups
  }, {} as Record<string, CommandItem[]>)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-2xl">
        <div className="flex flex-col">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses, lessons, commands..."
              className="border-0 focus-visible:ring-0 h-12 text-base"
              autoFocus
            />
            <kbd className="px-2 py-1 text-xs bg-muted rounded">ESC</kbd>
          </div>

          {/* Results */}
          <ScrollArea className="max-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-bhutan-yellow" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No results found for "{search}"</p>
              </div>
            ) : (
              <div className="p-2">
                {Object.entries(groupedResults).map(([category, items]) => (
                  <div key={category} className="mb-4">
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </div>
                    <div className="space-y-1">
                      {items.map(item => renderCommandItem(item))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background rounded text-xs">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background rounded text-xs">↵</kbd>
                  <span>Select</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background rounded text-xs">ESC</kbd>
                  <span>Close</span>
                </div>
              </div>
              {search && (
                <span>{results.length} results</span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Keyboard hint component for buttons
export function KeyboardHint({ shortcut }: { shortcut: string }) {
  return (
    <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded hidden md:inline-block">
      {shortcut}
    </kbd>
  )
}