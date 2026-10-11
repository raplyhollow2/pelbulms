'use client'

import { RichTextEditor } from '@/components/course/rich-text-editor'
import { courseDescriptionEditorHtml, courseDescriptionHtml, courseDescriptionRichClass } from '@/lib/course-description'

function prepareDescription(value: string) {
  return value.trim() ? courseDescriptionEditorHtml(value) : ''
}

function pasteDescription(source: string) {
  return courseDescriptionHtml(source)
}

const descriptionSurface = `min-h-28 w-full cursor-text rounded-md border-2 border-foreground/30 bg-background p-3 text-sm leading-relaxed focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] ${courseDescriptionRichClass}`

export function DescriptionEditor({
  id,
  value,
  onChange,
  onCommit,
  placeholder = 'Write what this is about',
  ariaLabel = 'Description',
  courseId,
}: {
  id?: string
  value: string
  onChange: (html: string) => void
  onCommit?: (html: string) => void
  placeholder?: string
  ariaLabel?: string
  courseId?: string
}) {
  return (
    <RichTextEditor
      id={id}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      courseId={courseId}
      prepareIncoming={prepareDescription}
      cleanPaste={pasteDescription}
      surfaceClassName={descriptionSurface}
    />
  )
}
