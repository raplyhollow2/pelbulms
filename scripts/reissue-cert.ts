/**
 * One-off: regenerate the Strategyzer course certificate with the ornamental frame.
 * Usage: npx tsx scripts/reissue-cert.ts
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateCertificatePdf } from '../lib/certificate-pdf'

const courseId = '8be7240d-a071-4fda-aa4f-925488cf5e6b'
const userId = 'a986fa19-0430-4b31-934a-b9f60990cad3'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Missing Supabase env')

  const supabase = createClient(url, key)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  const { data: course } = await supabase
    .from('courses')
    .select('title, instructor_id, certificate_settings, metadata')
    .eq('id', courseId)
    .single()

  const { data: existing } = await supabase
    .from('certificates')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()

  const design = (course as any).certificate_settings || {}
  const layout = design.layout
  console.log('layout keys', layout && Object.keys(layout))
  console.log('backgroundImage', layout?.backgroundImage)
  console.log('template', layout?.template)

  const verificationCode = existing?.verification_code || 'CERT-FA231D1C4678'
  const instructorName = design.signatureName || 'Instructor'

  const pdfBuffer = await generateCertificatePdf({
    recipientName: (profile as any)?.full_name || 'Student',
    courseTitle: (course as any).title,
    issuedDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    verificationCode,
    verifyUrl: `https://pelbulms.vercel.app/verify/${verificationCode}`,
    instructorName,
    design: {
      brandName: design.brandName,
      titleLine: design.titleLine,
      accentColor: design.accentColor,
      signatureName: design.signatureName,
      signatureTitle: design.signatureTitle,
      layout,
    },
  })

  const hasJpeg = pdfBuffer.includes(Buffer.from([0xff, 0xd8, 0xff]))
  const hasDct = pdfBuffer.toString('latin1').includes('/DCTDecode')
  console.log('pdf bytes', pdfBuffer.length, { hasJpeg, hasDct })
  if (!hasJpeg && !hasDct) {
    throw new Error('Generated PDF is missing the ornamental border image')
  }

  const storagePath = `${userId}/${courseId}.pdf`
  await supabase.storage.from('certificates').remove([storagePath])
  const { error: uploadError } = await supabase.storage
    .from('certificates')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '0',
    })
  if (uploadError) throw uploadError

  const { data: publicUrlData } = supabase.storage.from('certificates').getPublicUrl(storagePath)
  const certificateUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

  const { error: upsertError } = await supabase.from('certificates').upsert(
    {
      user_id: userId,
      course_id: courseId,
      enrollment_id: existing?.enrollment_id,
      certificate_url: certificateUrl,
      verification_code: verificationCode,
      issued_at: new Date().toISOString(),
      metadata: {
        course_title: (course as any).title,
        recipient_name: (profile as any)?.full_name || null,
        regenerated_at: new Date().toISOString(),
      },
    },
    { onConflict: 'user_id,course_id' }
  )
  if (upsertError) throw upsertError

  console.log('Uploaded:', certificateUrl)
  fs.writeFileSync('/tmp/cert-reissued.pdf', pdfBuffer)
  console.log('Also wrote /tmp/cert-reissued.pdf')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
