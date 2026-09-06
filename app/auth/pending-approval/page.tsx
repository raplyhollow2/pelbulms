'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, LogOut, Loader2, FilePenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function PendingApprovalPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [kycStatus, setKycStatus] = useState<string | null>(null)
  const [requestedRole, setRequestedRole] = useState<string | null>(null)

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
        if (!regStatus || regStatus === 'draft') {
          router.push('/auth/register')
          return
        }
        if (regStatus === 'additional_info_requested') {
          router.push('/auth/register')
          return
        }
        if (regStatus === 'approved' && data.account_status === 'active') {
          router.push('/dashboard')
          return
        }
        setRequestedRole(data.registration?.requested_role || 'student')
        if (regStatus === 'rejected') {
          setKycStatus('rejected')
        } else {
          setKycStatus(regStatus)
        }
      } catch {
        router.push('/auth/register')
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
      if (regStatus === 'additional_info_requested') {
        router.push('/auth/register')
        return
      }
      if (regStatus === 'approved' && data.account_status === 'active') {
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

  const teaching = requestedRole === 'instructor' || requestedRole === 'resource_person'

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bhutan-yellow/20">
            <Clock className="h-7 w-7 text-bhutan-orange" />
          </div>
          <CardTitle className="text-2xl">
            {kycStatus === 'rejected' ? 'Identity not approved' : 'Waiting for KYC approval'}
          </CardTitle>
          <CardDescription>
            {kycStatus === 'rejected'
              ? 'Your identity documents were not approved. You can update your KYC and resubmit.'
              : teaching
                ? 'A Superadmin is reviewing your instructor or resource person application. You cannot teach until that KYC is approved.'
                : 'An assigned reviewer, resource person, or administrator is confirming your CID and photos. You can request courses after approval.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {kycStatus === 'rejected' && (
            <Button
              className="w-full gap-2 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
              onClick={() => router.push('/auth/register')}
            >
              <FilePenLine className="h-4 w-4" />
              Update KYC and resubmit
            </Button>
          )}
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
