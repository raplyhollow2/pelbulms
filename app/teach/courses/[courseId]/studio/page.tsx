'use client'

import { useParams } from 'next/navigation'
import { CourseStudio } from '@/components/teach/course-studio'

export default function CourseStudioPage() {
  const params = useParams()
  const courseId = params.courseId as string
  return <CourseStudio courseId={courseId} />
}
