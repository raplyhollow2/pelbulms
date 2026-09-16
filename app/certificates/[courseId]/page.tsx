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

type CertificateRow = {
  id: string
  certificate_url: string | null
  verification_code: string | null
  issued_at: string | null
  course_id: string
}

export default function CertificateClaimPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string

  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courseTitle, setCourseTitle] = useState<string | null>(null)
  const [certificate, setCertificate] = useState<CertificateRow | null>(null)
  const [progress, setProgress] = useState<number>(0)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
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

      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('progress_percentage, status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

      const pct = Number((enrollment as any)?.progress_percentage) || 0
      setProgress(pct)

      const { data: existing } = await (supabase as any)
        .from('certificates')
        .select('id, certificate_url, verification_code, issued_at, course_id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()

      if (existing?.certificate_url) {
        setCertificate(existing as CertificateRow)
        // Still refresh PDF with latest course design (idempotent upsert)
        if (pct >= 100 || (enrollment as any)?.status === 'completed') {
          setIssuing(true)
          const res = await fetch('/api/certificates/issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, force: true }),
          })
          const json = await res.json().catch(() => ({}))
          if (res.ok && json.certificate) {
            setCertificate(json.certificate as CertificateRow)
          }
        }
        return
      }

      if (pct >= 100 || (enrollment as any)?.status === 'completed') {
        setIssuing(true)
        const res = await fetch('/api/certificates/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, force: true }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(json.error || 'Could not issue certificate yet.')
        } else if (json.certificate) {
          setCertificate(json.certificate as CertificateRow)
        }
      }
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
    if (certificate?.certificate_url) {
      const url = certificate.certificate_url.includes('?')
        ? `${certificate.certificate_url}&t=${Date.now()}`
        : `${certificate.certificate_url}?t=${Date.now()}`
      window.open(url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  const complete = progress >= 100 || Boolean(certificate)

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

      <Card className="glass overflow-hidden">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bhutan-yellow/20">
            <Award className="h-8 w-8 text-bhutan-orange" />
          </div>
          <CardTitle className="text-2xl">Certificate claim</CardTitle>
          <CardDescription className="text-base">
            {courseTitle || 'Your course'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {complete ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Course completed — certificate ready
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
              Finish all lectures to unlock your certificate ({progress}% complete).
            </div>
          )}

          {error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : null}

          {issuing ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing your certificate…
            </div>
          ) : null}

          {certificate?.certificate_url ? (
            <div className="space-y-3">
              {certificate.issued_at ? (
                <p className="text-center text-xs text-muted-foreground">
                  Issued {new Date(certificate.issued_at).toLocaleDateString()}
                  {certificate.verification_code
                    ? ` · ${certificate.verification_code}`
                    : ''}
                </p>
              ) : null}
              <Button
                className="min-h-11 w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange"
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
          ) : complete && !issuing ? (
            <Button
              className="min-h-11 w-full bg-bhutan-yellow text-black hover:bg-bhutan-orange"
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
