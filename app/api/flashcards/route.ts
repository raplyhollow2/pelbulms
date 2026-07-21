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

/**
 * POST — create or replace a flashcard deck (course-wide or per-lesson).
 * Body: { courseId, lessonId?, title?, cards: [{ front, back }] }
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const courseId = body.courseId as string
    const title =
      (body.title as string) ||
      (body.lessonId ? 'Lesson flashcards' : 'Course flashcards')
    const lessonId = (body.lessonId as string) || null
    const cards = (body.cards as { front: string; back: string }[]) || []

    if (!courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }

    const valid = cards.filter((c) => c.front?.trim() && c.back?.trim())
    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one card with front and back' },
        { status: 400 }
      )
    }

    const service = await createServiceClient()

    // Upsert: one deck per lesson (or one course-wide deck when lessonId is null)
    let deckQuery = (service as any)
      .from('flashcard_decks')
      .select('id')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(1)

    deckQuery = lessonId
      ? deckQuery.eq('lesson_id', lessonId)
      : deckQuery.is('lesson_id', null)

    const { data: existingRows } = await deckQuery
    let deckId = existingRows?.[0]?.id as string | undefined

    if (deckId) {
      const { error: updateError } = await (service as any)
        .from('flashcard_decks')
        .update({
          title,
          is_published: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deckId)
      if (updateError) throw updateError

      await (service as any).from('flashcards').delete().eq('deck_id', deckId)
    } else {
      const { data: deck, error: deckError } = await (service as any)
        .from('flashcard_decks')
        .insert({
          course_id: courseId,
          lesson_id: lessonId,
          instructor_id: rbac.userId,
          title,
          is_published: true,
        })
        .select('id')
        .single()
      if (deckError) throw deckError
      deckId = deck.id
    }

    const rows = valid.map((c, i) => ({
      deck_id: deckId,
      front: c.front.trim(),
      back: c.back.trim(),
      order_index: i,
    }))
    const { error: cardsError } = await (service as any).from('flashcards').insert(rows)
    if (cardsError) throw cardsError

    return NextResponse.json({ deck: { id: deckId, title, lesson_id: lessonId }, cards: rows })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save flashcards' }, { status: 500 })
  }
}
