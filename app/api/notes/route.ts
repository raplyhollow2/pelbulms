import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const lessonId = searchParams.get('lessonId')

    if (!lessonId) {
      return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })
    }

    // Fetch notes for the lesson
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error fetching notes:', error)
      throw error
    }

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lessonId, courseId, content, timestamp, userId } = body

    if (!lessonId || !content) {
      console.error('Missing required fields:', {
        lessonId: !!lessonId,
        content: !!content
      })
      return NextResponse.json(
        { error: 'Missing required fields', details: { lessonId: !!lessonId, content: !!content } },
        { status: 400 }
      )
    }

    // Try to create note with user_id if provided, otherwise without it
    let noteData: any = {
      lesson_id: lessonId,
      course_id: courseId || null,
      content,
      timestamp: timestamp || 0,
    }

    // Only add user_id if it's provided and looks valid
    if (userId && userId !== 'current-user' && userId.length > 10) {
      noteData.user_id = userId
    }

    // Create note
    const { data: note, error } = await supabase
      .from('notes')
      .insert(noteData)
      .select()
      .single()

    if (error) {
      console.error('Supabase error creating note:', error)

      // If it's a foreign key constraint error, try without user_id
      if (error.code === '23503' && error.message.includes('user_id')) {
        console.log('Retrying without user_id due to foreign key constraint')
        delete noteData.user_id

        const { data: retryNote, error: retryError } = await supabase
          .from('notes')
          .insert(noteData)
          .select()
          .single()

        if (retryError) {
          console.error('Supabase error creating note (retry):', retryError)
          throw retryError
        }

        return NextResponse.json(retryNote)
      }

      throw error
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { noteId, content, timestamp } = body

    if (!noteId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Update note
    const { data: note, error } = await supabase
      .from('notes')
      .update({
        content,
        timestamp: timestamp || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId)
      .select()
      .single()

    if (error) {
      console.error('Supabase error updating note:', error)
      throw error
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const noteId = searchParams.get('noteId')

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID required' }, { status: 400 })
    }

    // Soft delete note
    const { error } = await supabase
      .from('notes')
      .update({ is_deleted: true })
      .eq('id', noteId)

    if (error) {
      console.error('Supabase error deleting note:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}