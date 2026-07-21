import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const courseId = request.nextUrl.searchParams.get('courseId')
    if (!courseId) {
      return NextResponse.json({ error: 'Course ID required' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: rows, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const userIds = [...new Set((rows || []).map((r: any) => r.user_id).filter(Boolean))]
    let profilesById: Record<string, { full_name?: string; avatar_url?: string }> = {}
    if (userIds.length > 0) {
      const service = await createServiceClient()
      const { data: profiles } = await service
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)
      for (const p of (profiles || []) as any[]) {
        profilesById[p.id] = p
      }
    }

    const reviews = (rows || []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: profilesById[r.user_id]?.full_name || 'Student',
      user_avatar: profilesById[r.user_id]?.avatar_url,
      rating: r.rating,
      comment: r.comment || '',
      created_at: r.created_at,
      helpful_count: r.helpful_count || 0,
      not_helpful_count: r.not_helpful_count || 0,
    }))

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    let sum = 0
    for (const r of reviews) {
      const rating = Math.min(5, Math.max(1, Number(r.rating) || 0)) as 1 | 2 | 3 | 4 | 5
      distribution[rating] += 1
      sum += rating
    }
    const total = reviews.length
    const average = total ? Math.round((sum / total) * 10) / 10 : 0

    return NextResponse.json({
      reviews,
      stats: { average, total, distribution },
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const courseId = body.courseId as string
    const rating = Number(body.rating)
    const comment = (body.comment as string) || ''

    if (!courseId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'courseId and rating (1-5) are required' }, { status: 400 })
    }

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: 'Enroll in the course to leave a review' }, { status: 403 })
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    let review
    if (existing) {
      const { data, error } = await supabase
        .from('reviews')
        .update({
          rating,
          comment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existing as any).id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      review = data
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          course_id: courseId,
          rating,
          comment,
        })
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      review = data
    }

    // Refresh course aggregate rating
    const { data: all } = await supabase.from('reviews').select('rating').eq('course_id', courseId)
    const ratings = (all || []).map((r: any) => Number(r.rating) || 0)
    if (ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
      await supabase
        .from('courses')
        .update({
          average_rating: Math.round(avg * 10) / 10,
          rating_count: ratings.length,
        } as any)
        .eq('id', courseId)
    }

    return NextResponse.json({ review })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}
