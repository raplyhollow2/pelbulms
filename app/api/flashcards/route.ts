import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { checkRBAC } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const courseId = request.nextUrl.searchParams.get('courseId')
    const lessonId = request.nextUrl.searchParams.get('lessonId')
    if (!courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    if (lessonId) {
      // Prefer lesson deck, fall back to course-wide
      const { data: lessonDecks } = await (supabase as any)
        .from('flashcard_decks')
        .select('id, title, lesson_id')
        .eq('course_id', courseId)
        .eq('is_published', true)
        .eq('lesson_id', lessonId)
      if (lessonDecks?.length) {
        const deckIds = lessonDecks.map((d: any) => d.id)
        const { data: cards } = await (supabase as any)
          .from('flashcards')
          .select('*')
          .in('deck_id', deckIds)
          .order('order_index', { ascending: true })
        return NextResponse.json({ decks: lessonDecks, cards: cards || [] })
      }
    }

    const { data: decks } = await (supabase as any)
      .from('flashcard_decks')
      .select('id, title, lesson_id')
      .eq('course_id', courseId)
      .eq('is_published', true)
      .is('lesson_id', null)

    const deckIds = (decks || []).map((d: any) => d.id)
    if (deckIds.length === 0) {
      return NextResponse.json({ decks: [], cards: [] })
    }

    const { data: cards } = await (supabase as any)
      .from('flashcards')
      .select('*')
      .in('deck_id', deckIds)
      .order('order_index', { ascending: true })

    return NextResponse.json({ decks: decks || [], cards: cards || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load flashcards' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const courseId = body.courseId as string
    const title = (body.title as string) || 'Course flashcards'
    const lessonId = (body.lessonId as string) || null
    const cards = (body.cards as { front: string; back: string }[]) || []

    if (!courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }

    const service = await createServiceClient()

    const { data: deck, error: deckError } = await (service as any)
      .from('flashcard_decks')
      .insert({
        course_id: courseId,
        lesson_id: lessonId,
        instructor_id: rbac.userId,
        title,
        is_published: true,
      })
      .select('*')
      .single()

    if (deckError) throw deckError

    if (cards.length > 0) {
      const rows = cards
        .filter((c) => c.front?.trim() && c.back?.trim())
        .map((c, i) => ({
          deck_id: deck.id,
          front: c.front.trim(),
          back: c.back.trim(),
          order_index: i,
        }))
      if (rows.length) {
        const { error: cardsError } = await (service as any).from('flashcards').insert(rows)
        if (cardsError) throw cardsError
      }
    }

    return NextResponse.json({ deck })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save flashcards' }, { status: 500 })
  }
}
