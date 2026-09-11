export function slugifyInstitution(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base || 'institution'
}

export async function uniqueInstitutionSlug(
  service: { from: (table: string) => any },
  desired: string,
  excludeId?: string
): Promise<string> {
  let slug = slugifyInstitution(desired)
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? slug : `${slug}-${n + 1}`
    let q = service.from('institutions').select('id').eq('slug', candidate)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q.maybeSingle()
    if (!data) return candidate
  }
  return `${slug}-${Date.now().toString(36)}`
}
