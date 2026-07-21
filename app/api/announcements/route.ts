import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const courseId = request.nextUrl.searchParams.get('courseId')
    if (!courseId) {
      return NextResponse.json({ error: 'Course ID required' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    // Prefer published course announcements; also include global if column exists
    let query = supabase
      .from('announcements')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    const { data: rows, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const list = ((rows || []) as any[]).filter((a) => {
      if (a.is_published === false) return false
      if (a.publish_at && new Date(a.publish_at) > new Date()) return false
      if (a.expires_at && new Date(a.expires_at) < new Date()) return false
      return true
    })

    const authorIds = [
      ...new Set(list.map((a) => a.author_id || a.created_by).filter(Boolean)),
    ]
    let names: Record<string, string> = {}
    if (authorIds.length > 0) {
      const service = await createServiceClient()
      const { data: profiles } = await service
        .from('profiles')
        .select('id, full_name')
        .in('id', authorIds)
      for (const p of (profiles || []) as any[]) {
        names[p.id] = p.full_name || 'Instructor'
      }
    }

    const announcements = list.map((a) => {
      const authorId = a.author_id || a.created_by
      return {
        id: a.id,
        title: a.title,
        content: a.content,
        instructor_name: names[authorId] || 'Instructor',
        created_at: a.created_at,
        is_pinned: Boolean(a.is_pinned),
        likes_count: a.likes_count || 0,
        replies_count: a.replies_count || 0,
        priority: a.priority,
      }
    })

    // Pinned first
    announcements.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))

    return NextResponse.json({ announcements })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}
