'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, LogOut, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function PendingApprovalPage() {
  const router = useRouter()
  const supabase = createClient()

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
      if (data.account_status === 'active') {
        await supabase.auth.refreshSession()
        router.push('/dashboard')
        return
      }
      if (data.account_status === 'rejected') {
        router.push('/auth/access-denied')
        return
      }
      router.refresh()
    } catch {
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bhutan-yellow/20">
            <Clock className="h-7 w-7 text-bhutan-orange" />
          </div>
          <CardTitle className="text-2xl">Awaiting Approval</CardTitle>
          <CardDescription>
            Your account has been created and is pending review by an administrator.
            You&apos;ll get access as soon as it&apos;s approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleCheckAgain}
          >
            <BookOpen className="h-4 w-4" />
            Check again
          </Button>
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
