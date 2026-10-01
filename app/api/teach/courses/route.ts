import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC, withRBAC } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/teach/courses - Get teacher's courses (Instructor/Admin only)
 * Protected by RBAC middleware
 */
export const GET = withRBAC(
  async (request, { userId, userRole }) => {
    // This function only runs if user is instructor or admin
    return NextResponse.json({
      message: 'Teacher courses endpoint',
      teacherId: userId,
      role: userRole,
      timestamp: new Date().toISOString()
    })
  },
  ['instructor', 'admin']
)

/**
 * POST /api/teach/courses - Create a draft course as the signed-in teacher.
 * Uses the user session (not the service role) so course insert RLS applies.
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess || !rbac.userId) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const title = String(body.title || 'Untitled course').trim() || 'Untitled course'
  const slugBase = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const slug =
    String(body.slug || '').trim() ||
    `${slugBase || 'course'}-${Date.now().toString(36).slice(-5)}`

  const supabase = await createSupabaseServerClient()
  const { data, error } = await (supabase as any)
    .from('courses')
    .insert({
      instructor_id: rbac.userId,
      title,
      slug,
      description: body.description || null,
      category: body.category || 'General',
      level: body.level || 'beginner',
      language: body.language || 'English',
      is_published: false,
      is_featured: false,
      enrollment_mode: 'approval',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id, title })
}