import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'

async function requireUser(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const user = await getRequestUser(request)
  if (!user) {
    return { supabase, user: null as null, unauthorized: true as const }
  }
  return { supabase, user, unauthorized: false as const }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { supabase, user, unauthorized } = await requireUser(request)
    if (unauthorized || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { noteId } = await params
    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const { data: note, error } = await supabase
      .from('notes')
      .update({
        content: String(content).trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .select()
      .single()

    if (error) {
      console.error('Error updating note:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { supabase, user, unauthorized } = await requireUser(request)
    if (unauthorized || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { noteId } = await params

    const { error } = await supabase
      .from('notes')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting note:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
