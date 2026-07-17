import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/verify/[code]
 * Public certificate verification by verification_code.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    if (!code) {
      return NextResponse.json({ valid: false, error: 'Missing code' }, { status: 400 })
    }

    const service = await createServiceClient()
    const { data: cert } = await service
      .from('certificates')
      .select('*, courses(title, category), profiles(full_name)')
      .eq('verification_code', code)
      .maybeSingle()

    if (!cert) {
      return NextResponse.json({ valid: false })
    }

    const c = cert as any
    return NextResponse.json({
      valid: true,
      recipientName: c.profiles?.full_name || 'Student',
      courseTitle: c.courses?.title || 'Course',
      category: c.courses?.category || null,
      issuedAt: c.issued_at,
      verificationCode: c.verification_code,
      certificateUrl: c.certificate_url,
    })
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error?.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
