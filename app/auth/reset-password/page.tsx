'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Home, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled || data.user) return
        setError('Open the reset link from your email, then choose a new password here.')
      })
      .catch(() => {
        if (!cancelled) {
          setError('Open the reset link from your email, then choose a new password here.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        setError('Open the reset link from your email, then choose a new password here.')
        setBusy(false)
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        setBusy(false)
        return
      }
      window.location.assign('/dashboard')
    } catch (err) {
      console.error('Reset password error:', err)
      setError('Could not save the password. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-4 dark:from-gray-900 dark:to-black">
      <div className="w-full max-w-md">
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              Choose a new password. You will go straight into the LMS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat the new password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  disabled={busy}
                  minLength={8}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
              >
                {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Save and continue
              </Button>
              {error ? (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
        <p className="pt-4 text-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
