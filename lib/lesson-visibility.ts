/** Lesson publish and free-preview flags. `is_free` and `is_preview` are the same flag. */

export type LessonVisibility = {
  is_published?: boolean | null
  is_free?: boolean | null
  is_preview?: boolean | null
}

export function lessonIsPublished(lesson: LessonVisibility | null | undefined): boolean {
  return lesson?.is_published === true
}

export function lessonIsFreePreview(lesson: LessonVisibility | null | undefined): boolean {
  return lesson?.is_free === true || lesson?.is_preview === true
}

/** Write both preview columns together so either reader stays in sync. */
export function lessonPreviewColumns(enabled: boolean): { is_free: boolean; is_preview: boolean } {
  return { is_free: enabled, is_preview: enabled }
}
