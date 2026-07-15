import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const courseId = searchParams.get('courseId')

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID required' }, { status: 400 })
    }

    // Mock announcements data for now since the table might not exist
    const mockAnnouncements = [
      {
        id: '1',
        title: 'Welcome to the Course!',
        content: 'We are excited to have you join us. Get ready for an amazing learning journey!',
        instructor_name: 'Rajiv Pradhan',
        created_at: new Date().toISOString(),
        is_pinned: true,
        likes_count: 42,
        replies_count: 8
      },
      {
        id: '2',
        title: 'Course Materials Updated',
        content: 'I\'ve just updated the **Section 3** materials with the latest `Next.js 16` features. Make sure to check them out!',
        instructor_name: 'Rajiv Pradhan',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        is_pinned: false,
        likes_count: 28,
        replies_count: 5
      }
    ]

    return NextResponse.json({ announcements: mockAnnouncements })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}