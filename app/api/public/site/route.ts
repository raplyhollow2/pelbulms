// @ts-nocheck
import { NextResponse } from 'next/server'
import { getPlatformSettings, toPublicSite } from '@/lib/platform-settings'
import { tryCreateServiceClient, createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/public/site
 * Public marketing/site snapshot used by the landing page and maintenance gate.
 */
export async function GET() {
  const settings = await getPlatformSettings()
  const publicSite = toPublicSite(settings)

  let featured: { id: string; title: string; description: string | null; thumbnail_url: string | null }[] = []
  if (settings.public_catalog && settings.featured_course_ids.length) {
    try {
      const service = await tryCreateServiceClient()
      const client = service || (await createSupabaseServerClient())
      const { data } = await client
        .from('courses')
        .select('id, title, description, thumbnail_url')
        .in('id', settings.featured_course_ids)
        .eq('is_published', true)
      const byId = new Map((data || []).map((c: any) => [c.id, c]))
      featured = settings.featured_course_ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description || null,
          thumbnail_url: c.thumbnail_url || null,
        }))
    } catch {
      featured = []
    }
  }

  return NextResponse.json({
    ...publicSite,
    featured_courses: featured,
  })
}
