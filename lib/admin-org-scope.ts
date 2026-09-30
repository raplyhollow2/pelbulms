/** Organization membership for admins. Null means platform-wide. An empty list means the lookup failed. */

type Db = {
  from: (table: string) => any
}

export async function adminOrganizationIds(db: Db, userId: string): Promise<string[] | null> {
  const { data, error } = await db
    .from('institution_access')
    .select('institution_id')
    .eq('user_id', userId)
    .eq('role_within_institution', 'admin')
    .eq('is_active', true)

  if (error) return []

  const ids = [
    ...new Set(
      ((data || []) as { institution_id?: string | null }[])
        .map((row) => row.institution_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  return ids.length ? ids : null
}

export async function syncAdminOrganizations(db: Db, userId: string, institutionIds: string[]) {
  const unique = [...new Set(institutionIds.filter(Boolean))]
  await db
    .from('institution_access')
    .delete()
    .eq('user_id', userId)
    .eq('role_within_institution', 'admin')

  if (!unique.length) return { error: null as string | null }

  const { error } = await db.from('institution_access').upsert(
    unique.map((institution_id) => ({
      user_id: userId,
      institution_id,
      role_within_institution: 'admin',
      is_active: true,
    })),
    { onConflict: 'institution_id,user_id' }
  )
  return { error: error?.message || null }
}

/** Course ids offered to the admin's organizations. Null means every course. */
export async function scopedCourseIdsForAdmin(
  db: Db,
  userId: string,
  role: string | null | undefined
): Promise<string[] | null> {
  if (role === 'superadmin' || role !== 'admin') return null
  const orgs = await adminOrganizationIds(db, userId)
  if (!orgs) return null
  if (orgs.length === 0) return []
  const { data } = await db
    .from('course_institutions')
    .select('course_id')
    .in('institution_id', orgs)
  return [
    ...new Set(
      ((data || []) as { course_id?: string | null }[])
        .map((row) => row.course_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
}
