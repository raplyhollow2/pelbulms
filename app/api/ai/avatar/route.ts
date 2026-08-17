import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

/**
 * Talking-head avatars need a video vendor (HeyGen / D-ID / Tavus).
 * Gemini is used for the script; the vendor renders the video when HEYGEN_API_KEY is set.
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const script = String(body.script || '').trim()
  if (!script) return NextResponse.json({ error: 'script is required' }, { status: 400 })

  const key = process.env.HEYGEN_API_KEY
  if (!key) {
    return NextResponse.json({
      configured: false,
      message:
        'Avatar video needs a vendor API key (HEYGEN_API_KEY). Gemini can write the script; it cannot render a talking presenter by itself.',
      script,
    })
  }

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': key,
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: 'avatar', avatar_id: process.env.HEYGEN_AVATAR_ID || 'default' },
          voice: { type: 'text', input_text: script },
        },
      ],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: data.error || 'HeyGen request failed', details: data }, { status: 400 })
  }
  return NextResponse.json({ configured: true, job: data })
}
