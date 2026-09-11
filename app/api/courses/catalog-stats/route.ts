import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDbClient } from '@/lib/db'

/**
 * POST /api/courses/catalog-stats
 * Body: { courseIds: string[] }
 * Returns module + active/completed enrollment counts for catalog cards.
 * Uses service role when available so RLS does not hide other students.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { courseIds?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const courseIds = Array.isArray(body.courseIds)
      ? body.courseIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    if (!courseIds.length) {
      return NextResponse.json({ stats: {} })
    }

    // Cap to keep the catalog request bounded.
    const ids = courseIds.slice(0, 200)
    const db = await getDbClient()

    const [{ data: modules }, { data: enrollments }] = await Promise.all([
      db.from('modules').select('course_id').in('course_id', ids),
      db
        .from('enrollments')
        .select('course_id, status')
        .in('course_id', ids)
        .in('status', ['active', 'completed']),
    ])

    const stats: Record<string, { modules: number; students: number }> = {}
    for (const id of ids) {
      stats[id] = { modules: 0, students: 0 }
    }
    for (const row of modules || []) {
      const id = (row as { course_id?: string }).course_id
      if (id && stats[id]) stats[id].modules += 1
    }
    for (const row of enrollments || []) {
      const id = (row as { course_id?: string }).course_id
      if (id && stats[id]) stats[id].students += 1
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load catalog stats' },
      { status: 500 }
    )
  }
}
