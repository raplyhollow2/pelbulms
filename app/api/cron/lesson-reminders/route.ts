import { NextRequest, NextResponse } from 'next/server'
import { sendDueLessonReminders } from '@/lib/lesson-resume'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendDueLessonReminders()
  return NextResponse.json(result)
}
