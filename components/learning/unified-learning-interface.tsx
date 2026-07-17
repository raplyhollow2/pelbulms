'use client'

import { useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  BookOpen,
  LayoutDashboard,
  StickyNote,
  Bell,
  Star,
  Brain,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/utils'

// Import all learning components
import { CourseSyllabus } from './course-syllabus'
import { CourseOverview } from './course-overview'
import { TimestampNotes } from './timestamp-notes'
import { CourseAnnouncements } from './course-announcements'
import { ReviewsDashboard } from './reviews-dashboard'
import { LearningTools } from './learning-tools'

interface Section {
  id: string
  title: string
  description: string
  lessons: {
    id: string
    title: string
    description: string
    duration: number
    video_url: string
    is_free: boolean
    completed: boolean
  }[]
}

interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  language: string
  duration_minutes: number
  last_updated: string
  requirements?: string[]
  learningObjectives?: string[]
  targetAudience?: string[]
  instructor?: {
    full_name: string
    bio?: string
    avatar_url?: string
  }
}

interface Announcement {
  id: string
  courseId: string
  instructorId: string
  instructorName: string
  instructorAvatar?: string
  title: string
  content: string
  type: 'announcement' | 'update' | 'urgent' | 'milestone'
  isPinned: boolean
  likes: number
  commentCount: number
  createdAt: string
  updatedAt: string
}

interface Review {
  id: string
  courseId: string
  userId: string
  userName: string
  userAvatar?: string
  rating: number
  title: string
  content: string
  helpful: number
  notHelpful: number
  createdAt: string
  updatedAt: string
}

interface UnifiedLearningInterfaceProps {
  courseId: string
  course: Course
  sections: Section[]
  currentLessonId?: string
  announcements?: Announcement[]
  reviews?: Review[]
  onLessonClick?: (lessonId: string) => void
  onProgressUpdate?: (lessonId: string, completed: boolean) => void
  onNoteSave?: (note: any) => void
  onNoteUpdate?: (noteId: string, content: string) => void
  onNoteDelete?: (noteId: string) => void
  onAnnouncementLike?: (announcementId: string) => void
  onAnnouncementComment?: (announcementId: string) => void
  onReviewHelpful?: (reviewId: string, helpful: boolean) => void
  currentUserId?: string
  isFullscreen?: boolean
  onFullscreenToggle?: () => void
}

export function UnifiedLearningInterface({
  courseId,
  course,
  sections,
  currentLessonId,
  announcements = [],
  reviews = [],
  onLessonClick,
  onProgressUpdate,
  onNoteSave,
  onNoteUpdate,
  onNoteDelete,
  onAnnouncementLike,
  onAnnouncementComment,
  onReviewHelpful,
  currentUserId,
  isFullscreen = false,
  onFullscreenToggle
}: UnifiedLearningInterfaceProps) {
  const [activeTab, setActiveTab] = useState<string>('syllabus')
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set())
  const [isCompactMode, setIsCompactMode] = useState(false)

  // Video player reference for timestamp notes
  const videoRef = useRef<HTMLVideoElement>(null)

  // Calculate course progress
  const totalLessons = sections.reduce((acc, section) => acc + section.lessons.length, 0)
  const completedLessons = sections.reduce(
    (acc, section) => acc + section.lessons.filter(lesson => lesson.completed).length,
    0
  )
  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

  // Tab configuration with icons and badges
  const tabs = [
    {
      value: 'syllabus',
      label: 'Syllabus',
      icon: BookOpen,
      badge: `${completedLessons}/${totalLessons}`,
      color: 'text-bhutan-yellow'
    },
    {
      value: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
      color: 'text-blue-600'
    },
    {
      value: 'notes',
      label: 'Notes',
      icon: StickyNote,
      badge: null,
      color: 'text-purple-600'
    },
    {
      value: 'announcements',
      label: 'Announcements',
      icon: Bell,
      badge: announcements.length > 0 ? announcements.length.toString() : null,
      color: 'text-bhutan-red'
    },
    {
      value: 'reviews',
      label: 'Reviews',
      icon: Star,
      badge: reviews.length > 0 ? reviews.length.toString() : null,
      color: 'text-yellow-500'
    },
    {
      value: 'tools',
      label: 'Tools',
      icon: Brain,
      badge: null,
      color: 'text-green-600'
    }
  ]

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const handleFullscreenToggle = () => {
    if (onFullscreenToggle) {
      onFullscreenToggle()
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-background',
        isFullscreen && 'fixed inset-0 z-50 bg-background'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-lg truncate max-w-md">{course.title}</h2>
          <Badge variant="secondary" className="text-xs">
            {progressPercentage.toFixed(0)}% Complete
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Compact Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCompactMode(!isCompactMode)}
            title={isCompactMode ? 'Expand View' : 'Compact View'}
          >
            {isCompactMode ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreenToggle}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        'flex-1 overflow-hidden',
        isCompactMode ? 'max-h-[400px]' : 'h-[calc(100vh-120px)]'
      )}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
          {/* Custom Tab Navigation */}
          <div className="px-4 pt-3 bg-background/95 backdrop-blur border-b">
            <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.value

                return (
                  <button
                    key={tab.value}
                    onClick={() => handleTabChange(tab.value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'hover:bg-accent/50 text-muted-foreground'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', isActive && tab.color)} />
                    <span className="text-sm font-medium">{tab.label}</span>
                    {tab.badge && (
                      <Badge
                        variant={isActive ? 'secondary' : 'outline'}
                        className="text-xs ml-1"
                      >
                        {tab.badge}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {/* Syllabus Tab */}
            {activeTab === 'syllabus' && (
              <div className="h-full overflow-y-auto p-4">
                <CourseSyllabus
                  sections={sections}
                  currentLessonId={currentLessonId}
                  onLessonClick={onLessonClick}
                  onProgressUpdate={onProgressUpdate}
                  courseId={courseId}
                />
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="h-full">
                <CourseOverview course={course} />
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="h-full p-4">
                <TimestampNotes
                  lessonId={currentLessonId || ''}
                  videoRef={videoRef}
                  onSaveNote={onNoteSave}
                  onUpdateNote={onNoteUpdate}
                  onDeleteNote={onNoteDelete}
                />
              </div>
            )}

            {/* Announcements Tab */}
            {activeTab === 'announcements' && (
              <div className="h-full">
                <CourseAnnouncements
                  announcements={announcements}
                  currentUserId={currentUserId}
                  onLikeToggle={onAnnouncementLike}
                  onCommentClick={onAnnouncementComment}
                  markAsRead={(id) => console.log('Marked as read:', id)}
                />
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="h-full">
                <ReviewsDashboard
                  reviews={reviews}
                  onHelpfulClick={onReviewHelpful}
                  currentUserId={currentUserId}
                />
              </div>
            )}

            {/* Learning Tools Tab */}
            {activeTab === 'tools' && (
              <div className="h-full">
                <LearningTools
                  courseId={courseId}
                  lessonId={currentLessonId}
                />
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-bhutan-yellow transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  )
}