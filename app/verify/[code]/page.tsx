'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Award, CheckCircle, XCircle, Loader2, Download, Calendar, BookOpen } from 'lucide-react'

interface VerifyResult {
  valid: boolean
  recipientName?: string
  courseTitle?: string
  category?: string | null
  issuedAt?: string
  verificationCode?: string
  certificateUrl?: string | null
}

export default function VerifyCertificatePage() {
  const params = useParams()
  const code = params.code as string

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<VerifyResult | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/verify/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setResult(data)
      })
      .catch(() => {
        if (active) setResult({ valid: false })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-bhutan-yellow/20">
            <Award className="h-6 w-6 text-bhutan-yellow" />
          </div>
          <CardTitle>Certificate Verification</CardTitle>
          <p className="text-sm text-muted-foreground">Pelbu LMS</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
              <p className="mt-3 text-sm text-muted-foreground">Verifying...</p>
            </div>
          ) : result?.valid ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center rounded-lg border border-green-600/30 bg-green-600/5 p-5 text-center">
                <CheckCircle className="mb-2 h-10 w-10 text-green-600" />
                <p className="text-sm font-semibold text-green-700 dark:text-green-500">
                  This is a valid certificate
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Issued to</p>
                  <p className="text-lg font-bold">{result.recipientName}</p>
                </div>
                <div className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Course</p>
                    <p className="font-medium">{result.courseTitle}</p>
                    {result.category && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {result.category}
                      </Badge>
                    )}
                  </div>
                </div>
                {result.issuedAt && (
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date issued</p>
                      <p className="font-medium">
                        {new Date(result.issuedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Verification code</p>
                  <p className="font-mono text-sm">{result.verificationCode}</p>
                </div>
              </div>

              {result.certificateUrl && (
                <Button
                  className="w-full bg-bhutan-yellow hover:bg-bhutan-orange text-black"
                  onClick={() => window.open(result.certificateUrl!, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  View Certificate
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <XCircle className="mb-3 h-12 w-12 text-destructive" />
              <p className="text-sm font-semibold">Certificate not found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The code <span className="font-mono">{code}</span> does not match any issued certificate.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
