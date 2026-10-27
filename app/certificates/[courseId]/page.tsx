'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  Download,
  Loader2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { BrandCharacter } from '@/components/brand/brand-character'
import { certificateNeedsCidUpdate, isValidCid } from '@/lib/profile-fields'

type CertificateRow = {
  id: string
  certificate_url: string | null
  verification_code: string | null
  issued_at: string | null
  course_id: string
  metadata?: { cid?: string | null; course_title?: string | null } | null
}

export default function CertificateClaimPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string

  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cidRequired, setCidRequired] = useState(false)
  const [needsCidUpdate, setNeedsCidUpdate] = useState(false)
  const [designFrozen, setDesignFrozen] = useState(false)
  const [awarded, setAwarded] = useState(false)
  const [courseTitle, setCourseTitle] = useState<string | null>(null)
  const [certificate, setCertificate] = useState<CertificateRow | null>(null)
  const [progress, setProgress] = useState<number>(0)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setCidRequired(false)
      setNeedsCidUpdate(false)
      setDesignFrozen(false)
      setCertificate(null)
      setAwarded(false)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: course } = await supabase
        .from('courses')
        .select('id, title')
        .eq('id', courseId)
        .maybeSingle()
      setCourseTitle((course as any)?.title || null)

      const [{ data: enrollment }, { data: profile }] = await Promise.all([
        supabase
          .from('enrollments')
          .select('progress_percentage, status')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .maybeSingle(),
        supabase.from('profiles').select('cid_number').eq('id', user.id).maybeSingle(),
      ])

      const pct = Number((enrollment as any)?.progress_percentage) || 0
      setProgress(pct)
      const profileCid = isValidCid((profile as { cid_number?: string | null } | null)?.cid_number)

      const { data: existing } = await (supabase as any)
        .from('certificates')
        .select('id, certificate_url, verification_code, issued_at, course_id, metadata')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

      const existingCert = (existing as CertificateRow | null) || null
      const hasAward = Boolean(existingCert?.certificate_url)
      setAwarded(hasAward)
      const ready = pct >= 100 || (enrollment as any)?.status === 'completed' || hasAward
      if (!hasAward && !ready) {
        setCertificate(null)
        return
      }

      const existingNeedsUpdate = hasAward && certificateNeedsCidUpdate(existingCert?.metadata)
      if (existingNeedsUpdate && !profileCid) {
        setCertificate(existingCert)
        setNeedsCidUpdate(true)
        setCidRequired(true)
        return
      }
      if (hasAward && !existingNeedsUpdate) {
        setCertificate(existingCert)
        return
      }

      setLoading(false)
      setIssuing(true)
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          refresh: existingNeedsUpdate,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.designFrozen && json.certificate?.certificate_url) {
        setDesignFrozen(true)
        setCertificate(json.certificate as CertificateRow)
        return
      }
      if (json.code === 'cid_required') {
        setCidRequired(true)
        setNeedsCidUpdate(Boolean(json.certificate?.certificate_url))
        if (json.certificate?.certificate_url) {
          setCertificate(json.certificate as CertificateRow)
          setAwarded(true)
        } else {
          setCertificate(null)
        }
        setError(null)
        return
      }
      if (!res.ok || json.completionPending || !json.certificate?.certificate_url) {
        setCertificate(null)
        setError(json.error || 'Could not prepare the certificate.')
        return
      }
      setDesignFrozen(false)
      setCertificate(json.certificate as CertificateRow)
      setAwarded(true)
      setNeedsCidUpdate(certificateNeedsCidUpdate(json.certificate.metadata))
    } catch (e: any) {
      setError(e?.message || 'Failed to load certificate')
    } finally {
      setIssuing(false)
      setLoading(false)
    }
  }, [courseId, router])

  useEffect(() => {
    void load()
  }, [load])

  const download = () => {
    if (!certificate?.certificate_url) return
    window.open(certificate.certificate_url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const complete = progress >= 100 || awarded || Boolean(certificate)

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-6 min-h-11"
        onClick={() => router.push('/dashboard')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to dashboard
      </Button>

      <Card className="bg-card/80 border border-border overflow-hidden">
        <CardHeader className="space-y-3 text-center">
          <BrandCharacter pose="celebrate" className="mx-auto" />
          <CardTitle className="text-2xl">Certificate claim</CardTitle>
          <CardDescription className="text-base">
            {courseTitle || 'Your course'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {complete && !cidRequired ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Course completed — certificate ready
            </div>
          ) : complete && cidRequired ? (
            <div className="rounded-lg border border-amber-600/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-900 dark:text-amber-200">
              Course complete. Add your 11-digit CID on your profile
              {needsCidUpdate ? ' to get a revised certificate' : ' before claiming your certificate'}.
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
              Finish all lectures to unlock your certificate ({progress}% complete).
            </div>
          )}

          {cidRequired ? (
            <div className="space-y-3 text-center">
              <Button
                className="min-h-11 w-full"
                onClick={() => router.push('/profile#profile_cid')}
              >
                Update CID on profile
              </Button>
              <Button variant="outline" className="min-h-11 w-full" onClick={() => void load()}>
                I updated my CID — try again
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" className="min-h-11" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : null}

          {issuing ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing your certificate…
            </div>
          ) : null}

          {designFrozen && certificate?.certificate_url ? (
            <p className="text-center text-sm text-muted-foreground">
              This course is no longer updating certificates. You can still download the last issued file.
            </p>
          ) : null}

          {certificate?.certificate_url && !issuing ? (
            <div className="space-y-3">
              {needsCidUpdate ? (
                <p className="text-center text-sm text-muted-foreground">
                  This is your current certificate. Update your CID to receive a revised PDF.
                </p>
              ) : null}
              <iframe
                key={certificate.certificate_url}
                title="Certificate"
                src={certificate.certificate_url}
                className="h-[420px] w-full rounded-md border bg-white"
              />
              {certificate.issued_at ? (
                <p className="text-center text-xs text-muted-foreground">
                  Issued {new Date(certificate.issued_at).toLocaleDateString()}
                  {certificate.verification_code
                    ? ` · ${certificate.verification_code}`
                    : ''}
                </p>
              ) : null}
              <Button
                className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={download}
              >
                <Download className="mr-2 h-4 w-4" />
                Download certificate (PDF)
              </Button>
              {certificate.verification_code ? (
                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={() =>
                    window.open(`/verify/${certificate.verification_code}`, '_blank')
                  }
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify certificate
                </Button>
              ) : null}
            </div>
          ) : complete && !issuing && !error && !cidRequired ? (
            <Button
              className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => void load()}
            >
              <Award className="mr-2 h-4 w-4" />
              Claim certificate
            </Button>
          ) : null}

          <Button
            variant="ghost"
            className="min-h-11 w-full"
            onClick={() => router.push(`/learn/${courseId}`)}
          >
            Return to course
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
