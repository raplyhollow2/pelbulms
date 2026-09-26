'use client'

import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { CourseSettingsForm } from '@/components/teach/course-settings-form'

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => router.push(`/teach/courses/${courseId}/studio`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to studio
        </Button>
      </div>
      <h1 className="mb-2 text-xl font-semibold">Course settings</h1>
      <CourseSettingsForm courseId={courseId} />
    </div>
  )
}
