/** Learner visibility. Matches private.lesson_is_open in the scheduled-release migration. */

export type ModuleLiveFields = {
  availability?: string | null
  publish_at?: string | null
  release_lessons?: boolean | null
  is_published?: boolean | null
}

export type LessonOpenFields = {
  is_published?: boolean | null
  is_free?: boolean | null
  is_preview?: boolean | null
}

export function moduleIsLive(moduleRow: ModuleLiveFields | null | undefined, now = new Date()): boolean {
  if (!moduleRow) return false
  if (moduleRow.availability === 'published') return true
  if (moduleRow.availability === 'scheduled' && moduleRow.publish_at) {
    return new Date(moduleRow.publish_at).getTime() <= now.getTime()
  }
  if (!moduleRow.availability && moduleRow.is_published === true) return true
  return false
}

export function lessonOpenInModule(
  lesson: LessonOpenFields | null | undefined,
  moduleRow: ModuleLiveFields | null | undefined,
  now = new Date()
): boolean {
  if (!moduleIsLive(moduleRow, now)) return false
  if (lesson?.is_published === true) return true
  return (
    moduleRow?.availability === 'scheduled' &&
    moduleRow.release_lessons !== false &&
    Boolean(moduleRow.publish_at) &&
    new Date(moduleRow.publish_at as string).getTime() <= now.getTime()
  )
}

export function formatModuleRelease(moduleRow: ModuleLiveFields | null | undefined): string | null {
  if (!moduleRow || moduleIsLive(moduleRow)) return null
  if (moduleRow.availability !== 'scheduled' || !moduleRow.publish_at) return null
  const when = new Date(moduleRow.publish_at)
  if (Number.isNaN(when.getTime())) return null
  return `Opens ${when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
}

type Service = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

export async function lessonIsOpenForLearner(
  service: Service,
  lessonId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await service.rpc('lesson_is_open', {
    p_lesson_id: lessonId,
    p_user_id: userId,
  })
  if (error) {
    console.error('[lesson-open]', error.message)
    return false
  }
  return data === true
}
