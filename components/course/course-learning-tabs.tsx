'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CourseSyllabus } from './course-syllabus'
import { CourseOverview, type InstructorInfo } from './course-overview'
import { SimpleNotes } from './simple-notes'
import { AnnouncementsList } from './announcements-list'
import { ReviewsDashboard } from './reviews-dashboard'
import { LearningTools } from './learning-tools'
import { LessonResources } from './lesson-resources'
import { LessonForum } from './lesson-forum'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
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
  /** When true, Resources + flashcards (tools) stay locked */
  resourcesLocked?: boolean
  /** Student already finished gated activities */
  activityCompleted?: boolean
  onMarkActivitiesComplete?: () => void
  markingActivities?: boolean
  /** Which lesson ids are locked in the syllabus */
  lockedLessonIds?: Set<string>
}

export function CourseLearningTabs({
  course,
  modules,
  lessons,
  currentLessonId,
  currentLesson,
  currentModule,
  instructor,
  videoRef,
  userId,
  completedLessons,
  onLessonClick,
  onLessonComplete,
  resourcesLocked = false,
  activityCompleted = false,
  onMarkActivitiesComplete,
  markingActivities = false,
  lockedLessonIds,
}: CourseLearningTabsProps) {
  const [activeTab, setActiveTab] = useState('syllabus')

  const tabs = [
    { id: 'syllabus', label: 'Course Content', icon: FileText },
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'resources', label: 'Resources', icon: Paperclip },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'discussion', label: 'Discussion', icon: MessagesSquare },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'tools', label: 'Learning Tools', icon: Clock },
  ]

  const LockedPanel = ({ title }: { title: string }) => (
    <Card className="glass">
      <CardContent className="py-10 text-center space-y-3">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-medium">{title} locked</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Complete this lesson first. Resources and flashcards unlock after you mark the lesson
          complete.
        </p>
      </CardContent>
    </Card>
  )

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
        <TabsList className="inline-flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-4 lg:grid-cols-8 bg-secondary/30 h-auto p-1 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const locked =
              resourcesLocked && (tab.id === 'resources' || tab.id === 'tools')
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 sm:gap-2 px-3 data-[state=active]:bg-bhutan-yellow data-[state=active]:text-black shrink-0"
              >
                {locked ? (
                  <Lock className="w-4 h-4 shrink-0" />
                ) : (
                  <Icon className="w-4 h-4 shrink-0" />
                )}
                <span className="text-xs sm:text-sm whitespace-nowrap">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      <TabsContent value="syllabus" className="mt-6">
        <CourseSyllabus
          modules={modules}
          lessons={lessons}
          currentLessonId={currentLessonId}
          onLessonClick={onLessonClick}
          completedLessons={completedLessons}
          onLessonComplete={onLessonComplete}
          lockedLessonIds={lockedLessonIds}
        />
      </TabsContent>

      <TabsContent value="overview" className="mt-6">
        <CourseOverview
          course={course}
          instructor={instructor}
          moduleDescription={currentModule?.description}
        />
      </TabsContent>

      <TabsContent value="resources" className="mt-6 space-y-3">
        {resourcesLocked ? (
          <LockedPanel title="Resources" />
        ) : (
          <>
            <LessonResources resources={(currentLesson as any)?.resources} />
            {onMarkActivitiesComplete && !activityCompleted && (
              <Card className="glass border-bhutan-yellow/40">
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Finished the resources and flashcards? Mark them done to unlock the next lesson.
                  </p>
                  <Button
                    size="sm"
                    className="bg-bhutan-yellow hover:bg-bhutan-orange text-black shrink-0"
                    disabled={markingActivities}
                    onClick={() => onMarkActivitiesComplete()}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Mark activities complete
                  </Button>
                </CardContent>
              </Card>
            )}
            {activityCompleted && (
              <p className="text-xs text-green-700 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Activities completed — next lesson can unlock
              </p>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-6">
        <SimpleNotes
          lessonId={currentLessonId}
          courseId={course.id}
        />
      </TabsContent>

      <TabsContent value="announcements" className="mt-6">
        <AnnouncementsList
          courseId={course.id}
          userId={userId}
        />
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
        <ReviewsDashboard
          courseId={course.id}
          userId={userId}
        />
      </TabsContent>

      <TabsContent value="tools" className="mt-6 space-y-3">
        {resourcesLocked ? (
          <LockedPanel title="Learning tools" />
        ) : (
          <>
            <LearningTools
              courseId={course.id}
              lessonId={currentLessonId}
              userId={userId}
            />
            {onMarkActivitiesComplete && !activityCompleted && (
              <Card className="glass border-bhutan-yellow/40">
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Done with flashcards? Mark activities complete to unlock the next lesson.
                  </p>
                  <Button
                    size="sm"
                    className="bg-bhutan-yellow hover:bg-bhutan-orange text-black shrink-0"
                    disabled={markingActivities}
                    onClick={() => onMarkActivitiesComplete()}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Mark activities complete
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  )
}
