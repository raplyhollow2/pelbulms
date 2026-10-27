import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateCertificatePdf } from '@/lib/certificate-pdf'
import { describeCompletionBlockers } from '@/lib/activity-responses'
import { reconcileCourseCompletion } from '@/lib/lesson-completion-sync'
import { getRequestUser } from '@/lib/request-user'
import { publicAppUrl } from '@/lib/email/send'
import { isValidCid } from '@/lib/profile-fields'
import type { CertificateLayout } from '@/lib/certificate-layout'

export const runtime = 'nodejs'

function makeVerificationCode(): string {
  return (
    'CERT-' +
    globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
  )
}

function formatIssuedDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  return safe.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function isImageBuffer(buf: Uint8Array) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return true
  }
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    return true
  }
  return false
}

/** Drop portrait logos that cannot be embedded. Does not change the saved design. */
async function withoutUnreachablePortraits(layout: CertificateLayout): Promise<CertificateLayout> {
  const logos = []
  for (const logo of layout.logos) {
    if (!logo.id.startsWith('portrait-')) {
      logos.push(logo)
      continue
    }
    if (!logo.src) continue
    try {
      const response = await fetch(logo.src, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) continue
      const type = (response.headers.get('content-type') || '').toLowerCase()
      if (type.startsWith('image/')) {
        logos.push(logo)
        continue
      }
      const buf = new Uint8Array(await response.arrayBuffer())
      if (isImageBuffer(buf)) logos.push(logo)
    } catch {
      /* omit this portrait and still issue the certificate */
    }
  }
  return { ...layout, logos }
}

/**
 * POST /api/certificates/issue
 * Body: { courseId, refresh? }
 * First award requires a completed course. refresh rebuilds an existing PDF
 * from the current design without a new award date or verification code.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const courseId = body?.courseId as string | undefined
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const service = await createServiceClient()

    const { data: existing } = await service
      .from('certificates')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    const existingRow = existing as {
      id?: string
      certificate_url?: string | null
      verification_code?: string | null
      issued_at?: string | null
      created_at?: string | null
      enrollment_id?: string | null
      metadata?: {
        recipient_name?: string | null
        course_title?: string | null
        cid?: string | null
      } | null
    } | null
    const hasCertificate = Boolean(existingRow?.certificate_url)
    const refresh = Boolean(body?.refresh) && hasCertificate

    const { data: enrollment } = await service
      .from('enrollments')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!refresh) {
      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
      }

      const enrollStatus = (enrollment as { status?: string }).status
      if (enrollStatus && enrollStatus !== 'active' && enrollStatus !== 'completed') {
        return NextResponse.json({ error: 'Enrollment is not active' }, { status: 403 })
      }

      const { blockers } = await reconcileCourseCompletion(service, user.id, courseId)
      if (blockers.length > 0) {
        const waitingOnGrade = blockers.some(
          (blocker) => blocker.state === 'awaiting_grade' || blocker.state === 'below_pass'
        )
        const hold = waitingOnGrade
          ? `Course completion is waiting on grading. ${describeCompletionBlockers(blockers)}`
          : `Course completion is waiting on required activities. ${describeCompletionBlockers(blockers)}`
        if (hasCertificate) {
          return NextResponse.json(
            {
              certificate: existing,
              alreadyIssued: true,
              completionPending: true,
              error: hold,
              blockers,
            },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { error: hold, code: 'grading_required', blockers },
          { status: 400 }
        )
      }

      if (((enrollment as { progress_percentage?: number }).progress_percentage ?? 0) < 100) {
        return NextResponse.json(
          { error: 'Course is not fully completed yet' },
          { status: 400 }
        )
      }

      if (hasCertificate && !body?.force) {
        return NextResponse.json({ certificate: existing, alreadyIssued: true })
      }
    }

    const { data: profile } = await service
      .from('profiles')
      .select('full_name, cid_number')
      .eq('id', user.id)
      .single()

    const cid = isValidCid((profile as { cid_number?: string | null } | null)?.cid_number)
    if (!cid) {
      return NextResponse.json(
        {
          error:
            'Add your 11-digit CID on your profile before claiming your certificate.',
          code: 'cid_required',
          certificate: hasCertificate ? existing : undefined,
        },
        { status: 400 }
      )
    }

    const { data: course } = await service
      .from('courses')
      .select('title, instructor_id, certificate_enabled, certificate_settings, metadata')
      .eq('id', courseId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const courseRow = course as any

    if (courseRow.certificate_enabled === false) {
      if (refresh && existingRow) {
        return NextResponse.json({ certificate: existingRow, designFrozen: true })
      }
      return NextResponse.json(
        { error: 'Certificates are disabled for this course' },
        { status: 400 }
      )
    }

    let instructorName: string | undefined
    if (courseRow.instructor_id) {
      const { data: instructor } = await service
        .from('profiles')
        .select('full_name')
        .eq('id', courseRow.instructor_id)
        .maybeSingle()
      instructorName = (instructor as { full_name?: string } | null)?.full_name || undefined
    }

    const previousMeta =
      existingRow?.metadata && typeof existingRow.metadata === 'object' ? existingRow.metadata : {}
    const profileName = (profile as { full_name?: string | null } | null)?.full_name?.trim()
    const storedRecipient =
      typeof previousMeta.recipient_name === 'string' ? previousMeta.recipient_name.trim() : ''
    const recipientName = hasCertificate
      ? storedRecipient || profileName || user.email || 'Student'
      : profileName || user.email || 'Student'

    const issuedAtIso = hasCertificate
      ? existingRow?.issued_at || existingRow?.created_at || new Date().toISOString()
      : new Date().toISOString()
    const issuedDate = formatIssuedDate(issuedAtIso)

    const verificationCode = existingRow?.verification_code || makeVerificationCode()

    const appUrl = publicAppUrl(new URL(request.url).origin)
    const design = (courseRow.certificate_settings || {}) as Record<string, any>
    const theme = courseRow.metadata?.theme || {}
    const { defaultCertificateLayout, layoutWithSigners, signersFromLayout } = await import(
      '@/lib/certificate-layout'
    )
    let layout =
      design.layout && typeof design.layout === 'object'
        ? defaultCertificateLayout(design.layout)
        : defaultCertificateLayout({
            brandName: design.brandName,
            titleLine: design.titleLine,
            accentColor: design.accentColor || theme.primary,
            signatureName: design.signatureName || instructorName,
            signatureTitle: design.signatureTitle,
          })
    if (layout.template === 'ornamental' && !layout.backgroundImage) {
      layout = defaultCertificateLayout({
        ...layout,
        template: 'ornamental',
        backgroundImage: '/certificates/molhr-ornamental-border.jpg',
        borderStyle: 'none',
      })
    }
    layout = layoutWithSigners(layout, signersFromLayout(layout))
    layout = await withoutUnreachablePortraits(layout)

    const pdfBuffer = await generateCertificatePdf({
      recipientName,
      courseTitle: courseRow.title,
      issuedDate,
      verificationCode,
      verifyUrl: `${appUrl}/verify/${verificationCode}`,
      instructorName,
      cid,
      design: {
        brandName: design.brandName || layout.brandName,
        titleLine: design.titleLine || layout.titleLine,
        accentColor: design.accentColor || layout.accentColor || theme.primary,
        signatureName: design.signatureName || layout.signatureName || instructorName,
        signatureTitle: design.signatureTitle || layout.signatureTitle,
        logoUrl: design.logoUrl || theme.logoUrl,
        layout,
      },
    })

    if (!pdfBuffer?.length || pdfBuffer.length < 1000) {
      return NextResponse.json(
        { error: 'Certificate PDF generation produced an empty file' },
        { status: 500 }
      )
    }

    const storagePath = `${user.id}/${courseId}.pdf`
    const { error: uploadError } = await service.storage.from('certificates').upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '0',
    })

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to store certificate: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = service.storage.from('certificates').getPublicUrl(storagePath)
    const certificateUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
    const metadata = {
      ...previousMeta,
      course_title: courseRow.title,
      recipient_name: recipientName,
      cid,
    }

    if (hasCertificate && existingRow?.id) {
      const patch: Record<string, unknown> = {
        certificate_url: certificateUrl,
        metadata,
      }
      if (!existingRow.issued_at) patch.issued_at = issuedAtIso
      if ((enrollment as { id?: string } | null)?.id) {
        patch.enrollment_id = (enrollment as { id: string }).id
      }
      const { data: certificate, error: updateError } = await service
        .from('certificates')
        .update(patch as never)
        .eq('id', existingRow.id)
        .select()
        .single()
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }
      return NextResponse.json({ certificate }, { status: 200 })
    }

    const { data: certificate, error: upsertError } = await service
      .from('certificates')
      .upsert(
        {
          user_id: user.id,
          course_id: courseId,
          enrollment_id: (enrollment as { id: string }).id,
          certificate_url: certificateUrl,
          verification_code: verificationCode,
          issued_at: issuedAtIso,
          metadata,
        } as never,
        { onConflict: 'user_id,course_id' }
      )
      .select()
      .single()

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

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
