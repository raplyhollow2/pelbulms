import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> }
) {
  try {
    const { announcementId } = await params

    // For now, just return success since we're using mock data
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error liking announcement:', error)
    return NextResponse.json({ error: 'Failed to like announcement' }, { status: 500 })
  }
}