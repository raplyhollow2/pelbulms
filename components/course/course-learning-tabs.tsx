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
import { FileText, BookOpen, StickyNote, Bell, Star, Clock, Paperclip, MessagesSquare } from 'lucide-react'
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
  onLessonComplete
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
        <TabsList className="inline-flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-4 lg:grid-cols-8 bg-secondary/30 h-auto p-1 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 sm:gap-2 px-3 data-[state=active]:bg-bhutan-yellow data-[state=active]:text-black shrink-0"
              >
                <Icon className="w-4 h-4 shrink-0" />
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
        />
      </TabsContent>

      <TabsContent value="overview" className="mt-6">
        <CourseOverview
          course={course}
          instructor={instructor}
          moduleDescription={currentModule?.description}
        />
      </TabsContent>

      <TabsContent value="resources" className="mt-6">
        <LessonResources resources={(currentLesson as any)?.resources} />
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

      <TabsContent value="tools" className="mt-6">
        <LearningTools
          courseId={course.id}
          lessonId={currentLessonId}
          userId={userId}
        />
      </TabsContent>
    </Tabs>
  )
}