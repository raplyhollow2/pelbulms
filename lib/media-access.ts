import { userCanManageCourse } from '@/lib/course-access'
import { lessonIsOpenForLearner } from '@/lib/module-live'
import type { UserRole } from '@/lib/roles'
import { canAccessTeaching } from '@/lib/roles'
import type { createServiceClient } from '@/lib/supabase/server'
import { getGoogleDriveFileId } from '@/lib/video-url'

type Service = Awaited<ReturnType<typeof createServiceClient>>

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

function safeNeedle(publicId: string) {
  return publicId.replace(/[%_\\]/g, '').slice(0, 300)
}

async function enrolledOrPreview(
  service: Service,
  courseId: string,
  userId: string,
  lesson?: { is_published?: boolean | null; is_free?: boolean | null; is_preview?: boolean | null }
) {
  const { data: enrollment } = await service
    .from('enrollments')
    .select('status')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  const status = (enrollment as { status?: string } | null)?.status
  if (status === 'active' || status === 'completed') return true

  if (!lesson) return false
  const { data: course } = await service
    .from('courses')
    .select('is_published')
    .eq('id', courseId)
    .maybeSingle()
  return (
    (course as { is_published?: boolean } | null)?.is_published === true &&
    lesson.is_published === true &&
    (lesson.is_free === true || lesson.is_preview === true)
  )
}

/**
 * Private Cloudinary bytes are readable by the course staff, an enrolled learner,
 * or the owner of an unattached upload in their own folder.
 */
export async function userCanStreamMedia(
  service: Service,
  user: { id: string; role: UserRole | null },
  publicId: string
): Promise<boolean> {
  const needle = safeNeedle(publicId)
  if (!needle || needle.includes('..')) return false

  const { data: avatars } = await service
    .from('profiles')
    .select('id')
    .ilike('avatar_url', `%${needle}%`)
    .limit(1)
  if (avatars && avatars.length > 0) return true

  const { data: lessons } = await service
    .from('lessons')
    .select('id, module_id, is_published, is_free, is_preview')
    .ilike('video_url', `%${needle}%`)
    .limit(8)

  for (const lesson of lessons || []) {
    const moduleId = (lesson as { module_id?: string }).module_id
    if (!moduleId) continue
    const { data: mod } = await service.from('modules').select('course_id').eq('id', moduleId).maybeSingle()
    const courseId = (mod as { course_id?: string } | null)?.course_id
    if (!courseId) continue
    if (await userCanManageCourse(service, courseId, user.id, user.role || undefined)) return true
    const lessonId = (lesson as { id?: string }).id
    if (!lessonId) continue
    if (await lessonIsOpenForLearner(service, lessonId, user.id)) return true
  }

  if (/course-media|lesson-blocks/.test(needle)) {
    const ids = needle.match(UUID_RE) || []
    for (const id of ids) {
      if (await userCanManageCourse(service, id, user.id, user.role || undefined)) return true
      if (await enrolledOrPreview(service, id, user.id)) return true
    }
  }

  if (canAccessTeaching(user.role) && needle.includes(user.id)) return true

  const { data: settings } = await (service as any)
    .from('platform_settings')
    .select('hero_video_url')
    .limit(1)
    .maybeSingle()
  const hero = (settings as { hero_video_url?: string | null } | null)?.hero_video_url || ''
  if (hero && hero.includes(needle)) return true

  return false
}

/**
 * Duration lookups for a Drive lesson. The id is matched exactly after the
 * search, because `_` in a file id is a LIKE wildcard.
 */
export async function userCanReadDriveFile(
  service: Service,
  user: { id: string; role: UserRole | null },
  fileId: string
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(fileId)) return false

  const { data: lessons } = await service
    .from('lessons')
    .select('id, module_id, video_url, is_published, is_free, is_preview')
    .ilike('video_url', `%${fileId}%`)
    .limit(12)

  for (const lesson of lessons || []) {
    const row = lesson as {
      module_id?: string
      video_url?: string | null
      is_published?: boolean
      is_free?: boolean
      is_preview?: boolean
    }
    if (getGoogleDriveFileId(row.video_url || '') !== fileId) continue
    if (!row.module_id) continue
    const { data: mod } = await service.from('modules').select('course_id').eq('id', row.module_id).maybeSingle()
    const courseId = (mod as { course_id?: string } | null)?.course_id
    if (!courseId) continue
    if (await userCanManageCourse(service, courseId, user.id, user.role || undefined)) return true
    const lessonId = (lesson as { id?: string }).id
    if (lessonId && (await lessonIsOpenForLearner(service, lessonId, user.id))) return true
  }

  return false
}
