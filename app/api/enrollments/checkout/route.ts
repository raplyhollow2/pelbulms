import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/request-user'

/**
 * Paid checkout stays off until a payments ledger exists.
 * Approval enrollment is the launch path.
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (!body.courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

  return NextResponse.json(
    {
      error: 'Paid enrollment is not available.',
      enrollmentMode: 'paid',
    },
    { status: 501 }
  )
}
