'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, LogOut, BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function PendingApprovalPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [kycStatus, setKycStatus] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/register')
        if (res.status === 401) {
          router.push('/auth/login')
          return
        }
        const data = await res.json()
        if (data.account_status === 'rejected' || data.account_status === 'suspended') {
          router.push('/auth/access-denied')
          return
        }
        const regStatus = data.registration?.registration_status as string | undefined
        if (!regStatus) {
          // No KYC submission — LMS access does not require this page
          router.push('/dashboard')
          return
        }
        if (regStatus === 'approved') {
          router.push('/dashboard')
          return
        }
        if (regStatus === 'rejected') {
          setKycStatus('rejected')
        } else {
          setKycStatus(regStatus)
        }
      } catch {
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleCheckAgain = async () => {
    try {
      const res = await fetch('/api/register')
      if (!res.ok) {
        router.refresh()
        return
      }
      const data = await res.json()
      if (data.account_status === 'rejected' || data.account_status === 'suspended') {
        router.push('/auth/access-denied')
        return
      }
      const regStatus = data.registration?.registration_status
      if (regStatus === 'approved') {
        await supabase.auth.refreshSession()
        router.push('/dashboard')
        return
      }
      setKycStatus(regStatus || null)
      router.refresh()
    } catch {
      router.refresh()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bhutan-yellow/20">
            <Clock className="h-7 w-7 text-bhutan-orange" />
          </div>
          <CardTitle className="text-2xl">
            {kycStatus === 'rejected' ? 'Profile review declined' : 'Profile under review'}
          </CardTitle>
          <CardDescription>
            {kycStatus === 'rejected'
              ? 'Your optional identity profile was not approved. You can still browse the LMS and request course enrollment.'
              : 'Thanks for submitting your details. An administrator may review them for certificates and institutional records. You already have full LMS browse access.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full gap-2 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
            onClick={() => router.push('/dashboard')}
          >
            <BookOpen className="h-4 w-4" />
            Continue to LMS
          </Button>
          {kycStatus !== 'rejected' && (
            <Button variant="outline" className="w-full gap-2" onClick={handleCheckAgain}>
              Check review status
            </Button>
          )}
          <Button variant="ghost" className="w-full gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Need help?{' '}
            <Link href="/" className="underline underline-offset-4">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
