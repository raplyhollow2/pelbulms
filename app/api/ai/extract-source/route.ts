// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { geminiExtractFromFile, geminiText } from '@/lib/gemini'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const contentType = request.headers.get('content-type') || ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
      if (file.size > 4.5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File must be under 4.5MB' }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        return NextResponse.json({ text: buf.toString('utf8') })
      }
      const text = await geminiExtractFromFile({
        userId: rbac.userId,
        mimeType: file.type || 'application/octet-stream',
        base64: buf.toString('base64'),
        hint: `Extract educational text from ${file.name}. Preserve headings.`,
      })
      return NextResponse.json({ text })
    }

    const body = await request.json().catch(() => ({}))
    const url = String(body.url || '').trim()
    if (!url) return NextResponse.json({ error: 'url or file is required' }, { status: 400 })
    const text = await geminiText(
      `Fetch and summarize this learning source for course generation. If it is a YouTube URL, use the title and any known topic. URL: ${url}
Return plain text notes (headings + bullets), max 4000 words.`,
      { userId: rbac.userId }
    )
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not extract source' }, { status: 500 })
  }
}
