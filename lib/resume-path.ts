/** Deep-link into the last lesson the student was on. */
export function resumeLearnPath(
  courseId: string,
  lastLessonId?: string | null
): string {
  if (lastLessonId) {
    return `/learn/${courseId}/lesson/${lastLessonId}`
  }
  return `/learn/${courseId}`
}
