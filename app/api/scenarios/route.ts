// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { courseIdByLesson, userCanManageCourse } from '@/lib/course-access'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function GET(request: NextRequest) {
  try {
    const lessonId = request.nextUrl.searchParams.get('lessonId')
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
    }

    // Prefer service client when available; otherwise use the signed-in session
    // (lesson_scenarios_select allows authenticated reads).
    const service = await tryCreateServiceClient()
    const supabase = service || (await createSupabaseServerClient())

    if (!service) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ scenarios: [] })
      }
    }

    const { data, error } = await supabase
      .from('lesson_scenarios')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ scenarios: [], error: error.message })
    }
    return NextResponse.json({ scenarios: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { scenarios: [], error: error?.message || 'Failed to load scenarios' },
      { status: 200 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const { lessonId, title, nodes, isPublished } = body || {}
  if (!lessonId || !title) {
    return NextResponse.json({ error: 'lessonId and title are required' }, { status: 400 })
  }

  const service = await tryCreateServiceClient()
  const supabase = service || (await createSupabaseServerClient())
  const accessClient = service || supabase

  const courseId = await courseIdByLesson(accessClient, lessonId)
  if (!courseId || !(await userCanManageCourse(accessClient, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('lesson_scenarios')
    .insert({
      lesson_id: lessonId,
      title,
      nodes: nodes || [],
      is_published: Boolean(isPublished),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ scenario: data })
}
