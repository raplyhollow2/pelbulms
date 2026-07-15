'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  BookOpen,
  FileText,
  Video,
  CheckCircle,
  Circle,
  Play,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Lesson {
  id: string
  title: string
  description?: string
  duration_minutes?: number
  type?: 'video' | 'reading' | 'quiz' | 'assignment'
  is_completed?: boolean
  is_locked?: boolean
}

interface Module {
  id: string
  title: string
  description?: string
  order_index: number
  lessons?: Lesson[]
  is_locked?: boolean
}

interface CurriculumTimelineProps {
  modules: Module[]
  currentLessonId?: string
  onLessonClick?: (lessonId: string) => void
  showProgress?: boolean
  overallProgress?: number
}

export function CurriculumTimeline({
  modules,
  currentLessonId,
  onLessonClick,
  showProgress = true,
  overallProgress = 0,
}: CurriculumTimelineProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.slice(0, 2).map(m => m.id))
  )

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev)
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId)
      } else {
        newSet.add(moduleId)
      }
      return newSet
    })
  }

  const getModuleProgress = (module: Module) => {
    if (!module.lessons || module.lessons.length === 0) return 0
    const completed = module.lessons.filter(l => l.is_completed).length
    return Math.round((completed / module.lessons.length) * 100)
  }

  const getLessonIcon = (lesson: Lesson) => {
    if (lesson.is_locked) return <Lock className="w-4 h-4 text-muted-foreground" />
    if (lesson.is_completed) return <CheckCircle className="w-4 h-4 text-green-600" />
    if (lesson.id === currentLessonId) return <Play className="w-4 h-4 text-bhutan-yellow" />
    return <Circle className="w-4 h-4 text-muted-foreground" />
  }

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />
      case 'reading': return <FileText className="w-4 h-4" />
      case 'quiz': return <BookOpen className="w-4 h-4" />
      default: return <BookOpen className="w-4 h-4" />
    }
  }

  const getTotalDuration = (module: Module) => {
    if (!module.lessons) return '0m'
    const totalMinutes = module.lessons.reduce((sum, lesson) => sum + (lesson.duration_minutes || 0), 0)
    if (totalMinutes === 0) return 'Self-paced'
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      {showProgress && (
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Your Progress</span>
              <span className="text-sm font-bold text-bhutan-yellow">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0)} lessons</span>
              <span>{Math.round(modules.reduce((sum, m) => sum + (m.lessons?.filter(l => l.is_completed).length || 0), 0))} completed</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border/50" />

        {modules.map((module, moduleIndex) => {
          const isExpanded = expandedModules.has(module.id)
          const moduleProgress = getModuleProgress(module)
          const duration = getTotalDuration(module)

          return (
            <div key={module.id} className="relative mb-6">
              {/* Module Header */}
              <div
                className={cn(
                  "relative flex items-start gap-4 p-4 rounded-lg border transition-all duration-200 cursor-pointer",
                  "hover:border-bhutan-yellow/50 hover:shadow-lg",
                  module.is_locked && "opacity-60 cursor-not-allowed hover:border-border",
                  isExpanded && "border-bhutan-yellow/30 shadow-md"
                )}
                onClick={() => !module.is_locked && toggleModule(module.id)}
              >
                {/* Module Number Circle */}
                <div className={cn(
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  module.is_locked
                    ? "bg-muted text-muted-foreground"
                    : "bg-bhutan-yellow text-black font-bold"
                )}>
                  {moduleIndex + 1}
                </div>

                {/* Module Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{module.title}</h4>
                    {module.is_locked && (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {module.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {module.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      <span>{module.lessons?.length || 0} lessons</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{duration}</span>
                    </div>
                    {moduleProgress > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {moduleProgress}% complete
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expand/Collapse Icon */}
                {!module.is_locked && (
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>

              {/* Lessons (Expanded) */}
              {isExpanded && !module.is_locked && module.lessons && module.lessons.length > 0 && (
                <div className="ml-8 mt-3 space-y-2">
                  {module.lessons.map((lesson, lessonIndex) => {
                    const isCurrent = lesson.id === currentLessonId
                    const isLocked = lesson.is_locked

                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          "relative flex items-center gap-3 p-3 rounded-lg border border-border/50 transition-all duration-200",
                          "hover:border-bhutan-yellow/30",
                          isCurrent && "border-bhutan-yellow/50 bg-bhutan-yellow/5",
                          isLocked && "opacity-60 cursor-not-allowed",
                          !isLocked && !isCurrent && "cursor-pointer"
                        )}
                        onClick={() => !isLocked && onLessonClick?.(lesson.id)}
                      >
                        {/* Timeline Dot */}
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                          <div className={cn(
                            "w-2 h-2 rounded-full border-2 border-background",
                            isCurrent
                              ? "bg-bhutan-yellow"
                              : lesson.is_completed
                                ? "bg-green-600"
                                : "bg-muted"
                          )} />
                        </div>

                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {getLessonIcon(lesson)}
                        </div>

                        {/* Lesson Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium",
                              isCurrent && "text-bhutan-yellow"
                            )}>
                              {lesson.title}
                            </span>
                            {isCurrent && (
                              <Badge className="bg-bhutan-yellow text-black text-xs">
                                Current
                              </Badge>
                            )}
                            {lesson.is_completed && (
                              <Badge variant="outline" className="text-xs">
                                Completed
                              </Badge>
                            )}
                          </div>

                          {lesson.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {lesson.description}
                            </p>
                          )}
                        </div>

                        {/* Type Icon & Duration */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                          <div className="flex items-center gap-1">
                            {getTypeIcon(lesson.type)}
                          </div>
                          {lesson.duration_minutes && (
                            <span>{lesson.duration_minutes}m</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <Card className="glass-strong">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-bhutan-yellow" />
              <span>Current</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-muted-foreground" />
              <span>Not Started</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span>Locked</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}