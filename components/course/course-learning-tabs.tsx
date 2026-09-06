'use client'

import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CourseOverview, type InstructorInfo } from './course-overview'
import { SimpleNotes } from './simple-notes'
import { AnnouncementsList } from './announcements-list'
import { ReviewsDashboard } from './reviews-dashboard'
import { LearningTools } from './learning-tools'
import { LessonResources, type ActivityProgressItem } from './lesson-resources'
import { LessonForum } from './lesson-forum'
import { Card, CardContent } from '@/components/ui/card'
import {
  BookOpen,
  StickyNote,
  Bell,
  Star,
  Clock,
  Paperclip,
  MessagesSquare,
  Lock,
  CheckCircle,
} from 'lucide-react'
import type { Database } from '@/types/database.types'

type Course = Database['public']['Tables']['courses']['Row']
type Module = Database['public']['Tables']['modules']['Row']
type Lesson = Database['public']['Tables']['lessons']['Row']

interface CourseLearningTabsProps {
  course: Course
  modules: Module[]
  lessons: Lesson[]
  currentLessonId: string
  currentLesson?: Lesson | null
  currentModule?: Module | null
  instructor?: InstructorInfo | null
  videoRef: React.RefObject<HTMLVideoElement>
  userId?: string
  completedLessons: Set<string>
  onLessonClick: (lessonId: string) => void
  onLessonComplete: (lessonId: string, completed: boolean) => void
  resourcesLocked?: boolean
  activityCompleted?: boolean
  mandatoryTotal?: number
  mandatoryCompleted?: number
  activityProgressById?: Record<string, ActivityProgressItem>
  onMarkActivityDone?: (activityId: string) => void | Promise<void>
  markingActivityId?: string | null
  lockedLessonIds?: Set<string>
  moduleResources?: unknown
  onTakeQuiz?: (quizId: string) => void
  /** Scenarios / quiz CTA — kept under Activities, off the first viewport */
  activitiesExtra?: ReactNode
  defaultTab?: string
}

export function CourseLearningTabs({
  course,
  modules: _modules,
  lessons: _lessons,
  currentLessonId,
  currentLesson,
  currentModule,
  instructor,
  videoRef,
  userId,
  completedLessons: _completedLessons,
  onLessonClick: _onLessonClick,
  onLessonComplete: _onLessonComplete,
  resourcesLocked = false,
  activityCompleted = false,
  mandatoryTotal = 0,
  mandatoryCompleted = 0,
  activityProgressById,
  onMarkActivityDone,
  markingActivityId,
  lockedLessonIds: _lockedLessonIds,
  moduleResources,
  onTakeQuiz,
  activitiesExtra,
  defaultTab = 'overview',
}: CourseLearningTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'discussion', label: 'Q&A', icon: MessagesSquare },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'tools', label: 'Learning tools', icon: Clock },
    { id: 'resources', label: 'Resources', icon: Paperclip },
  ]

  const LockedPanel = ({ title }: { title: string }) => (
    <Card className="glass">
      <CardContent className="space-y-3 py-10 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="font-medium">{title} locked</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Complete this lesson first. Resources and flashcards unlock after you mark the lesson
          complete.
        </p>
      </CardContent>
    </Card>
  )

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="-mx-1 overflow-x-auto px-1 scrollbar-hide">
        <TabsList
          variant="line"
          className="inline-flex h-auto w-max min-w-full justify-start gap-0 rounded-none bg-transparent p-0"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const locked =
              resourcesLocked && (tab.id === 'resources' || tab.id === 'tools')
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-none px-3 text-muted-foreground data-active:bg-transparent data-active:text-foreground sm:gap-2"
              >
                {locked ? (
                  <Lock className="h-4 w-4 shrink-0" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
                <span className="whitespace-nowrap text-xs sm:text-sm">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-6">
        <CourseOverview
          course={course}
          instructor={instructor}
          moduleDescription={currentModule?.description}
        />
      </TabsContent>

      <TabsContent value="resources" className="mt-6 space-y-3">
        {resourcesLocked ? (
          <LockedPanel title="Activities" />
        ) : (
          <>
            <LessonResources
              resources={(currentLesson as any)?.resources}
              extraResources={moduleResources}
              onTakeQuiz={onTakeQuiz}
              progressById={activityProgressById}
              mandatoryTotal={mandatoryTotal}
              mandatoryCompleted={mandatoryCompleted}
              onMarkDone={onMarkActivityDone}
              markingActivityId={markingActivityId}
            />
            {activitiesExtra}
            {mandatoryTotal > 0 && (
              <p
                className={`flex items-center gap-1 text-xs ${
                  activityCompleted ? 'text-green-700' : 'text-muted-foreground'
                }`}
              >
                {activityCompleted ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : null}
                {mandatoryCompleted} of {mandatoryTotal} mandatory activities complete
                {activityCompleted ? ' — next lesson can unlock' : ''}
              </p>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-6">
        <SimpleNotes lessonId={currentLessonId} courseId={course.id} />
      </TabsContent>

      <TabsContent value="announcements" className="mt-6">
        <AnnouncementsList courseId={course.id} userId={userId} />
      </TabsContent>

      <TabsContent value="discussion" className="mt-6">
        <LessonForum
          courseId={course.id}
          moduleId={currentModule?.id}
          lessonId={currentLessonId}
          userId={userId}
        />
      </TabsContent>

      <TabsContent value="reviews" className="mt-6">
        <ReviewsDashboard courseId={course.id} userId={userId} />
      </TabsContent>

      <TabsContent value="tools" className="mt-6 space-y-3">
        {resourcesLocked ? (
          <LockedPanel title="Learning tools" />
        ) : (
          <LearningTools courseId={course.id} lessonId={currentLessonId} userId={userId} />
        )}
      </TabsContent>
    </Tabs>
  )
}
