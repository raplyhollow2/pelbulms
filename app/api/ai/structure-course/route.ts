import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { parseModelFamily } from '@/lib/ai/models'
import { isAiGatewayConfigured } from '@/lib/ai/complete'
import {
  applyCourseStructure,
  courseStructureSchema,
  proposeCourseStructure,
  type CourseStructureProposal,
} from '@/lib/ai/course-structure'
import type { CourseOutline } from '@/lib/ai-course-builder'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

async function loadCourseOutline(service: { from: (table: string) => any }, courseId: string) {
  const { data: course, error } = await service
    .from('courses')
    .select('title, description, learning_objectives')
    .eq('id', courseId)
    .maybeSingle()
  if (error || !course) throw new Error(error?.message || 'Course not found')

  const { data: modules, error: moduleError } = await service
    .from('modules')
    .select('id, title, description, order_index')
    .eq('course_id', courseId)
    .order('order_index')
  if (moduleError) throw new Error(moduleError.message)

  const moduleRows = (modules || []) as {
    id: string
    title: string
    description: string | null
    order_index: number
  }[]
  const moduleIds = moduleRows.map((row) => row.id)
  let lessons: { module_id: string; title: string; description: string | null; order_index: number }[] = []
  if (moduleIds.length) {
    const { data, error: lessonError } = await service
      .from('lessons')
      .select('module_id, title, description, order_index')
      .in('module_id', moduleIds)
      .order('order_index')
    if (lessonError) throw new Error(lessonError.message)
    lessons = (data || []) as typeof lessons
  }

  return {
    title: (course as { title?: string }).title,
    description: (course as { description?: string | null }).description || '',
    learningObjectives: ((course as { learning_objectives?: string[] | null }).learning_objectives ||
      []) as string[],
    modules: moduleRows.map((mod) => ({
      title: mod.title,
      description: mod.description || '',
      lessons: lessons
        .filter((lesson) => lesson.module_id === mod.id)
        .map((lesson) => ({
          title: lesson.title,
          description: lesson.description || '',
        })),
    })),
  }
}

/** POST /api/ai/structure-course { action: 'propose' | 'apply', ... } */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action === 'apply' ? 'apply' : 'propose'
  const courseId = typeof body.courseId === 'string' ? body.courseId : ''
  const service = await createServiceClient()

  if (courseId) {
    const allowed = await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (action === 'apply') {
    if (!courseId) return NextResponse.json({ error: 'courseId is required to apply' }, { status: 400 })
    const parsed = courseStructureSchema.safeParse(body.proposal)
    if (!parsed.success) {
      return NextResponse.json({ error: 'The proposal is not valid.' }, { status: 400 })
    }
    const indexes = Array.isArray(body.acceptedModuleIndexes)
      ? body.acceptedModuleIndexes.filter((value: unknown) => Number.isInteger(value))
      : parsed.data.modules.map((_, index) => index)
    try {
      await applyCourseStructure(service, courseId, parsed.data, indexes as number[])
      return NextResponse.json({ ok: true })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Could not apply the structure' },
        { status: 500 }
      )
    }
  }

  if (!isAiGatewayConfigured()) {
    return NextResponse.json(
      {
        error:
          'AI Gateway is not configured. Set AI_GATEWAY_API_KEY (or deploy with Vercel OIDC) to restructure courses.',
      },
      { status: 503 }
    )
  }

  const instruction = String(body.instruction || '').trim()
  if (!instruction) return NextResponse.json({ error: 'Describe how to restructure the course.' }, { status: 400 })

  try {
    const outline = courseId
      ? await loadCourseOutline(service, courseId)
      : outlineFromBody(body.outline)
    if (!outline.modules.length && !outline.title) {
      return NextResponse.json({ error: 'There is no course structure to reshape yet.' }, { status: 400 })
    }
    const family = body.family ? parseModelFamily(body.family, 'chatgpt') : undefined
    const result = await proposeCourseStructure({
      instruction,
      outline,
      family,
      userId: rbac.userId,
    })
    return NextResponse.json(result)
  } catch (error) {
    const status = (error as { status?: number }).status || 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not propose a structure' },
      { status }
    )
  }
}

function outlineFromBody(raw: unknown): {
  title?: string
  description?: string
  learningObjectives?: string[]
  modules: { title: string; description?: string; lessons: { title: string; description?: string }[] }[]
} {
  const outline = (raw || {}) as Partial<CourseOutline>
  return {
    title: outline.title,
    description: outline.description,
    learningObjectives: outline.learningObjectives,
    modules: (outline.modules || []).map((mod) => ({
      title: mod.title,
      description: mod.description,
      lessons: (mod.lessons || []).map((lesson) => ({
        title: lesson.title,
        description: lesson.description,
      })),
    })),
  }
}
