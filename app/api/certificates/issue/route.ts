import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { generateCertificatePdf } from '@/lib/certificate-pdf'

export const runtime = 'nodejs'

function makeVerificationCode(): string {
  return (
    'CERT-' +
    globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
  )
}

/**
 * POST /api/certificates/issue
 * Body: { courseId }
 * Idempotently issues a completion certificate (PDF + DB row) for the
 * authenticated user once their enrollment reaches 100%.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await createSupabaseServerClient()
    const {
      data: { user },
    } = await auth.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const courseId = body?.courseId as string | undefined
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const service = await createServiceClient()

    // Server-side completion check
    const { data: enrollment } = await service
      .from('enrollments')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
    }

    const enrollStatus = (enrollment as any).status
    if (enrollStatus && enrollStatus !== 'active' && enrollStatus !== 'completed') {
      return NextResponse.json({ error: 'Enrollment is not active' }, { status: 403 })
    }

    if (((enrollment as any).progress_percentage ?? 0) < 100) {
      return NextResponse.json(
        { error: 'Course is not fully completed yet' },
        { status: 400 }
      )
    }

    // Return existing certificate if already issued
    const { data: existing } = await service
      .from('certificates')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (existing && (existing as any).certificate_url) {
      return NextResponse.json({ certificate: existing, alreadyIssued: true })
    }

    // Gather data for the PDF
    const { data: profile } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const { data: course } = await service
      .from('courses')
      .select('title, instructor_id, certificate_enabled, certificate_settings')
      .eq('id', courseId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if ((course as any).certificate_enabled === false) {
      return NextResponse.json(
        { error: 'Certificates are disabled for this course' },
        { status: 400 }
      )
    }

    let instructorName: string | undefined
    if ((course as any).instructor_id) {
      const { data: instructor } = await service
        .from('profiles')
        .select('full_name')
        .eq('id', (course as any).instructor_id)
        .maybeSingle()
      instructorName = (instructor as any)?.full_name || undefined
    }

    const verificationCode =
      (existing as any)?.verification_code || makeVerificationCode()

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const issuedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const design = ((course as any).certificate_settings || {}) as Record<string, string>

    // Generate the PDF
    const pdfBuffer = await generateCertificatePdf({
      recipientName: (profile as any)?.full_name || user.email || 'Student',
      courseTitle: (course as any).title,
      issuedDate,
      verificationCode,
      verifyUrl: `${appUrl}/verify/${verificationCode}`,
      instructorName,
      design: {
        brandName: design.brandName,
        titleLine: design.titleLine,
        accentColor: design.accentColor,
        signatureName: design.signatureName || instructorName,
        signatureTitle: design.signatureTitle,
      },
    })

    // Upload to Storage
    const path = `${user.id}/${courseId}.pdf`
    const { error: uploadError } = await service.storage
      .from('certificates')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to store certificate: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = service.storage
      .from('certificates')
      .getPublicUrl(path)
    const certificateUrl = publicUrlData.publicUrl

    // Upsert the certificate row
    const { data: certificate, error: upsertError } = await service
      .from('certificates')
      .upsert(
        {
          user_id: user.id,
          course_id: courseId,
          enrollment_id: (enrollment as any).id,
          certificate_url: certificateUrl,
          verification_code: verificationCode,
          issued_at: new Date().toISOString(),
          metadata: {
            course_title: (course as any).title,
            recipient_name: (profile as any)?.full_name || null,
          },
        } as any,
        { onConflict: 'user_id,course_id' }
      )
      .select()
      .single()

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    // First-time completion → notify the course instructor
    try {
      const { notifyTeacherOfCompletion } = await import('@/lib/notify-teachers')
      await notifyTeacherOfCompletion(service, {
        courseId,
        studentId: user.id,
      })
    } catch (notifyErr) {
      console.error('[certificates] teacher notify failed:', notifyErr)
    }

    return NextResponse.json({ certificate }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to issue certificate' },
      { status: 500 }
    )
  }
}
