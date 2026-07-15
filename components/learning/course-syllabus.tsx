'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Play,
  FileText,
  Code,
  Clock,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Video,
  Terminal,
  FileQuestion,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'

interface Lesson {
  id: string
  title: string
  description: string
  video_url: string
  duration_minutes: number
  type: 'video' | 'text' | 'exercise' | 'quiz' | 'resource'
  is_completed: boolean
  is_free: boolean
  order_index: number
  module_id: string
}

interface Section {
  id: string
  title: string
  description: string
  order_index: number
  lessons: Lesson[]
  course_id: string
}

interface CourseSyllabusProps {
  sections: Section[]
  currentLessonId?: string
  onLessonClick: (lessonId: string) => void
  onProgressUpdate?: (lessonId: string, completed: boolean) => void
  courseId: string
}

export function CourseSyllabus({
  sections,
  currentLessonId,
  onLessonClick,
  onProgressUpdate,
  courseId
}: CourseSyllabusProps) {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set())
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const activeLessonRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Initialize completed lessons from sections
  useEffect(() => {
    const completed = new Set<string>()
    sections.forEach(section => {
      section.lessons.forEach(lesson => {
        if (lesson.is_completed) {
          completed.add(lesson.id)
        }
      })
    })
    setCompletedLessons(completed)
  }, [sections])

  // Auto-scroll to active lesson
  useEffect(() => {
    if (currentLessonId && activeLessonRef.current) {
      setTimeout(() => {
        activeLessonRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }, 300)
    }
  }, [currentLessonId])

  // Calculate section progress
  const getSectionProgress = (section: Section) => {
    const totalLessons = section.lessons.length
    const completedLessons = section.lessons.filter(l =>
      completedLessons.has(l.id)
    ).length
    return { completed: completedLessons, total: totalLessons }
  }

  // Get section total duration
  const getSectionDuration = (section: Section) => {
    const totalMinutes = section.lessons.reduce((acc, lesson) =>
      acc + (lesson.duration_minutes || 0), 0
    )
    return formatDuration(totalMinutes)
  }

  // Format duration to readable string
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  // Get lesson icon based on type
  const getLessonIcon = (type: Lesson['type']) => {
    switch (type) {
      case 'video': return <Play className="w-4 h-4" />
      case 'text': return <FileText className="w-4 h-4" />
      case 'exercise': return <Terminal className="w-4 h-4" />
      case 'quiz': return <FileQuestion className="w-4 h-4" />
      case 'resource': return <BookOpen className="w-4 h-4" />
      default: return <Video className="w-4 h-4" />
    }
  }

  // Handle lesson completion toggle
  const handleToggleComplete = (lessonId: string, checked: boolean) => {
    haptic()
    setCompletedLessons(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(lessonId)
      } else {
        newSet.delete(lessonId)
      }
      return newSet
    })

    // Call parent callback if provided
    if (onProgressUpdate) {
      onProgressUpdate(lessonId, checked)
    }
  }

  // Handle lesson click
  const handleLessonClick = (lessonId: string) => {
    haptic()
    onLessonClick(lessonId)
  }

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" ref={scrollAreaRef}>
      <div className="p-4 space-y-3">
        {sections.map((section, sectionIndex) => {
          const progress = getSectionProgress(section)
          const isActive = activeSection === section.id

          return (
            <Accordion
              key={section.id}
              type="single"
              collapsible
              className="glass rounded-lg overflow-hidden"
              onValueChange={(value) => {
                if (value) setActiveSection(section.id)
              }}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline group">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 group-hover:bg-primary/20">
                      <span className="text-xs font-semibold text-primary">
                        {sectionIndex + 1}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {section.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {progress.completed}/{progress.total} Completed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      {getSectionDuration(section)}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {progress.completed > 0 && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      <ChevronRight className="w-4 h-4 transition-transform duration-200" />
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-1 pt-2">
                  {section.lessons
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((lesson) => {
                      const isCurrentLesson = lesson.id === currentLessonId
                      const isCompleted = completedLessons.has(lesson.id)

                      return (
                        <div
                          key={lesson.id}
                          ref={isCurrentLesson ? activeLessonRef : null}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                            "hover:bg-accent/50 cursor-pointer group",
                            isCurrentLesson && "bg-primary/10 border-l-4 border-primary"
                          )}
                          onClick={() => handleLessonClick(lesson.id)}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-background/50 group-hover:bg-background transition-colors">
                            <div className={cn(
                              "text-primary",
                              isCurrentLesson && "text-primary"
                            )}>
                              {getLessonIcon(lesson.type)}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={cn(
                                "text-sm font-medium truncate transition-colors",
                                isCurrentLesson && "text-primary font-semibold"
                              )}>
                                {lesson.order_index + 1}. {lesson.title}
                              </h4>
                              {isCurrentLesson && (
                                <Badge variant="default" className="text-xs bg-primary">
                                  Playing
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {lesson.description || 'No description'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDuration(lesson.duration_minutes || 0)}
                            </Badge>

                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={(checked) => {
                                handleToggleComplete(lesson.id, checked || false)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "transition-all duration-200",
                                isCompleted && "border-green-600 bg-green-600"
                              )}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </AccordionContent>
            </Accordion>
          )
        })}
      </div>
    </ScrollArea>
  )
}