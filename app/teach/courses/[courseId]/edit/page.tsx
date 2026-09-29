'use client'

import { useParams } from 'next/navigation'
import { CourseSettingsForm } from '@/components/teach/course-settings-form'

export default function EditCoursePage() {
  const params = useParams()
  const courseId = params.courseId as string

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <CourseSettingsForm courseId={courseId} layout="page" />
    </div>
  )
}
