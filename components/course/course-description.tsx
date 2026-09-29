import { courseDescriptionRichClass } from '@/lib/course-description'
import { sanitizeHtml } from '@/lib/lesson-blocks'
import { cn } from '@/lib/utils'

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value)
}

export function CourseDescription({
  text,
  className,
}: {
  text?: string | null
  className?: string
}) {
  const value = String(text || '')
  if (!value.trim()) return null
  if (looksLikeHtml(value)) {
    return (
      <div
        className={cn('max-w-none text-sm leading-relaxed', courseDescriptionRichClass, className)}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
      />
    )
  }
  return <p className={cn('whitespace-pre-wrap', className)}>{value}</p>
}
