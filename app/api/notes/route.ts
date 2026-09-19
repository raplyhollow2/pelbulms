import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null as null, unauthorized: true as const }
  }
  return { supabase, user, unauthorized: false as const }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, unauthorized } = await requireUser()
    if (unauthorized || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const lessonId = request.nextUrl.searchParams.get('lessonId')
    if (!lessonId) {
      return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })
    }

    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error fetching notes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notes: notes || [] })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, unauthorized } = await requireUser()
    if (unauthorized || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { lessonId, courseId, content, timestamp } = body

    if (!lessonId || !courseId || !content?.trim()) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: {
            lessonId: !!lessonId,
            courseId: !!courseId,
            content: !!content?.trim(),
          },
        },
        { status: 400 }
      )
    }

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        lesson_id: lessonId,
        course_id: courseId,
        content: String(content).trim(),
        timestamp: typeof timestamp === 'number' ? timestamp : 0,
        is_deleted: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error creating note:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user, unauthorized } = await requireUser()
    if (unauthorized || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { noteId, content, timestamp } = body

    if (!noteId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: note, error } = await supabase
      .from('notes')
      .update({
        content: String(content).trim(),
        timestamp: typeof timestamp === 'number' ? timestamp : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .select()
      .single()

    if (error) {
      console.error('Supabase error updating note:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, unauthorized } = await requireUser()
    if (unauthorized || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const noteId = request.nextUrl.searchParams.get('noteId')
    if (!noteId) {
      return NextResponse.json({ error: 'Note ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('notes')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Supabase error deleting note:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
