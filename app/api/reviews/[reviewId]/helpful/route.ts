import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params

    // For now, just return success since we're using mock data
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking review as helpful:', error)
    return NextResponse.json({ error: 'Failed to mark review as helpful' }, { status: 500 })
  }
}