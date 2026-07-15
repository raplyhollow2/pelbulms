'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play, FileText, Code, Clock, CheckCircle, Circle, ChevronRight } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Lesson = Database['public']['Tables']['lessons']['Row']
type Module = Database['public']['Tables']['modules']['Row']

interface CourseSyllabusProps {
  modules: Module[]
  lessons: Lesson[]
  currentLessonId: string
  onLessonClick: (lessonId: string) => void
  completedLessons: Set<string>
  onLessonComplete: (lessonId: string, completed: boolean) => void
}

export function CourseSyllabus({
  modules,
  lessons,
  currentLessonId,
  onLessonClick,
  completedLessons,
  onLessonComplete
}: CourseSyllabusProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScrolled, setAutoScrolled] = useState(false)

  // Auto-scroll to current lesson
  useEffect(() => {
    if (!autoScrolled && scrollRef.current && currentLessonId) {
      const activeElement = scrollRef.current.querySelector(`[data-lesson-id="${currentLessonId}"]`)
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setAutoScrolled(true)
      }
    }
  }, [currentLessonId, autoScrolled])

  // Group lessons by module
  const modulesWithLessons = modules.map(module => {
    const moduleLessons = lessons.filter(lesson => lesson.module_id === module.id)
    const completedCount = moduleLessons.filter(lesson => completedLessons.has(lesson.id)).length
    const totalDuration = moduleLessons.reduce((acc, lesson) => acc + (lesson.duration_minutes || 0), 0)

    return {
      ...module,
      lessons: moduleLessons,
      completedCount,
      totalDuration
    }
  }).filter(module => module.lessons.length > 0)

  const getLessonIcon = (lesson: Lesson) => {
    if (lesson.lesson_type === 'video') return Play
    if (lesson.lesson_type === 'resource') return FileText
    if (lesson.lesson_type === 'exercise') return Code
    return FileText
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Course Content
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4" ref={scrollRef}>
          <Accordion type="multiple" defaultValue={modulesWithLessons.map(m => m.id)}>
            {modulesWithLessons.map((module) => (
              <AccordionItem key={module.id} value={module.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2 text-left">
                      <ChevronRight className="w-4 h-4 transition-transform" />
                      <span className="font-medium">{module.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {module.completedCount}/{module.lessons.length}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDuration(module.totalDuration)}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pt-2">
                    {module.lessons.map((lesson, index) => {
                      const Icon = getLessonIcon(lesson)
                      const isCompleted = completedLessons.has(lesson.id)
                      const isActive = lesson.id === currentLessonId

                      return (
                        <div
                          key={lesson.id}
                          data-lesson-id={lesson.id}
                          className={`group flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                            isActive
                              ? 'bg-primary/10 border-l-4 border-primary'
                              : 'hover:bg-secondary/50'
                          }`}
                        >
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={(checked) => {
                              onLessonComplete(lesson.id, checked as boolean)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0"
                          />

                          <div
                            className="flex items-center gap-3 flex-1 min-w-0"
                            onClick={() => onLessonClick(lesson.id)}
                          >
                            <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/20' : 'bg-secondary'}`}>
                              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{lesson.title}</span>
                                {isCompleted && (
                                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {lesson.lesson_type || 'video'}
                                </Badge>
                                {lesson.duration_minutes && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(lesson.duration_minutes)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}