export type CourseFacilitator = {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  social_links?: unknown
  staffRole: string
}

// course_instructors is not in the generated Database types yet.
type FacilitatorClient = {
  from: (table: any) => any
}

/**
 * Course owner plus every co-teacher / assistant on course_instructors.
 * The owner lives on courses.instructor_id and is not always a staff row.
 */
export async function loadCourseFacilitators(
  supabase: FacilitatorClient,
  courseId: string,
  ownerId?: string | null
): Promise<CourseFacilitator[]> {
  const { data: staffRows } = await supabase
    .from('course_instructors')
    .select('user_id, role')
    .eq('course_id', courseId)

  const staffList = (staffRows || []) as Array<{ user_id: string; role: string }>
  const ids = new Set<string>()
  if (ownerId) ids.add(ownerId)
  for (const row of staffList) {
    if (row.user_id) ids.add(row.user_id)
  }
  if (ids.size === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, social_links')
    .in('id', Array.from(ids))

  const roleByUser = new Map(staffList.map((row) => [row.user_id, row.role]))
  return ((profiles || []) as Array<{
    id: string
    full_name: string | null
    avatar_url: string | null
    bio: string | null
    social_links?: unknown
  }>)
    .map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      social_links: profile.social_links,
      staffRole:
        profile.id === ownerId ? 'owner' : roleByUser.get(profile.id) || 'co_teacher',
    }))
    .sort((a, b) => {
      if (a.staffRole === 'owner') return -1
      if (b.staffRole === 'owner') return 1
      return (a.full_name || '').localeCompare(b.full_name || '')
    })
}
