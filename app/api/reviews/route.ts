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

    // Mock reviews data for now
    const mockReviews = [
      {
        id: '1',
        user_id: 'user1',
        user_name: 'Jane Doe',
        rating: 5,
        comment: 'This course saved me weeks of reading docs! The explanations are clear and the projects are practical.',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        helpful_count: 42,
        not_helpful_count: 2
      },
      {
        id: '2',
        user_name: 'John Smith',
        rating: 4,
        comment: 'Great content and well-structured. Would love to see more advanced topics covered.',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        helpful_count: 28,
        not_helpful_count: 5
      },
      {
        id: '3',
        user_name: 'Alice Johnson',
        rating: 5,
        comment: 'Finally understood Next.js! The instructor makes complex concepts easy to grasp.',
        created_at: new Date(Date.now() - 259200000).toISOString(),
        helpful_count: 35,
        not_helpful_count: 1
      }
    ]

    const stats = {
      average: 4.7,
      total: 124,
      distribution: { 5: 85, 4: 25, 3: 10, 2: 3, 1: 1 }
    }

    return NextResponse.json({ reviews: mockReviews, stats })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}