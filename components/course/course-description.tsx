import { courseDescriptionHtml, courseDescriptionRichClass } from '@/lib/course-description'
import { cn } from '@/lib/utils'

export function CourseDescription({
  text,
  className,
}: {
  text?: string | null
  className?: string
}) {
  const html = courseDescriptionHtml(text)
  if (!html) return null
  return (
    <div
      className={cn('max-w-none text-sm leading-relaxed', courseDescriptionRichClass, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
