/** Deep-link into the last lesson. `/learn/[courseId]` also jumps to the player. */
export function resumeLearnPath(
  courseId: string,
  lastLessonId?: string | null
): string {
  if (lastLessonId) {
    return `/learn/${courseId}/lesson/${lastLessonId}`
  }
  return `/learn/${courseId}`
}
