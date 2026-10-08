'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, Fingerprint, Mail } from 'lucide-react'
import { AuthSplit } from '@/components/auth/auth-split'
import { useAuthSite } from '@/components/auth/auth-site'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignedInPublicGuard } from '@/components/auth/signed-in-public-guard'
import { createClient } from '@/lib/supabase/client'
import { startSocialOAuth, registerNativeGoogleCompletion, type SocialProvider } from '@/lib/oauth'

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

type Busy = null | 'passkey' | 'email' | SocialProvider
type EmailMode = 'signin' | 'signup'

function explainEmailAuthError(message: string, mode: EmailMode) {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'That email and password do not match. If you first joined with Google, this account has no password yet. Use Continue with Google, or choose Forgot password.'
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'This email already has an account. Sign in with Google, or choose Forgot password.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirm this email before signing in. Open the message we sent, then come back and sign in with the password you chose.'
  }
  if (mode === 'signup' && lower.includes('signups not allowed')) {
    return 'Email sign-up is turned off for this site. Use Continue with Google.'
  }
  return message
}

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [emailMode, setEmailMode] = useState<EmailMode>('signin')
  const { siteName } = useAuthSite()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      setError(decodeURIComponent(urlError))
    }
  }, [searchParams])

  useEffect(() => {
    return registerNativeGoogleCompletion((message) => {
      setBusy(null)
      setError(message)
    })
  }, [])

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy('email')
    setError('')
    setNotice('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Enter your email and password.')
      setBusy(null)
      return
    }
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.')
      setBusy(null)
      return
    }

    try {
      const supabase = createClient()
      if (emailMode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (signUpError) {
          setError(explainEmailAuthError(signUpError.message, 'signup'))
          setBusy(null)
          return
        }
        const alreadyRegistered = (data.user?.identities?.length ?? 0) === 0
        if (alreadyRegistered) {
          setError(explainEmailAuthError('User already registered', 'signup'))
          setBusy(null)
          return
        }
        if (!data.session) {
          setNotice('Check your email to confirm your account, then sign in here.')
          setEmailMode('signin')
          setBusy(null)
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (signInError) {
          setError(explainEmailAuthError(signInError.message, 'signin'))
          setBusy(null)
          return
        }
      }
      window.location.assign('/dashboard')
    } catch (err) {
      console.error('Email auth error:', err)
      setError('Email sign-in failed. Please try again.')
      setBusy(null)
    }
  }

  const handlePasswordLink = async () => {
    const trimmedEmail = email.trim()
    setError('')
    setNotice('')
    if (!trimmedEmail) {
      setError('Enter your email, then choose Forgot password.')
      return
    }
    setBusy('email')
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
        setBusy(null)
        return
      }
      setNotice('Check your email and open the reset link. Choose a new password there to enter the LMS.')
      setBusy(null)
    } catch (err) {
      console.error('Password link error:', err)
      setError('Could not send the password link. Please try again.')
      setBusy(null)
    }
  }

  const handlePasskeySignIn = async () => {
    setBusy('passkey')
    setError('')

    try {
      const supabase = createClient()
      const { data, error: passkeyError } = await supabase.auth.signInWithPasskey()

      if (passkeyError) {
        setError(passkeyError.message)
        setBusy(null)
      } else if (data) {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Passkey error:', err)
      setError('Passkey authentication failed. Please try again.')
      setBusy(null)
    }
  }

  const handleOAuthSignIn = async (provider: SocialProvider) => {
    setBusy(provider)
    setError('')

    try {
      await startSocialOAuth(provider)
    } catch (err) {
      console.error('OAuth error:', err)
      const message = err instanceof Error ? err.message : `${provider} authentication failed. Please try again.`
      setError(message)
      setBusy(null)
    }
  }

  const disabled = busy !== null

  return (
    <AuthSplit>
      <SignedInPublicGuard />
      <Card size="sm">
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Welcome to {siteName}</h1>
          <CardDescription>Use Google, or type your email and password</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => handleOAuthSignIn('google')}
              disabled={disabled}
              variant="outline"
              className="w-full"
            >
                {busy === 'google' ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <GoogleIcon className="mr-2 h-5 w-5" />
                )}
                Continue with Google
              </Button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <form className="space-y-3" onSubmit={handleEmailAuth}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={disabled}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={disabled}
                    minLength={8}
                    required
                  />
                  {emailMode === 'signin' ? (
                    <p className="text-right text-sm">
                      <button
                        type="button"
                        className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        onClick={handlePasswordLink}
                        disabled={disabled}
                      >
                        Forgot password?
                      </button>
                    </p>
                  ) : null}
                </div>
                <Button type="submit" disabled={disabled} className="w-full">
                  {busy === 'email' ? <Loader2 className="animate-spin" /> : <Mail />}
                  {emailMode === 'signup' ? 'Create account' : 'Sign in with email'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {emailMode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-4"
                    onClick={() => {
                      setEmailMode((mode) => (mode === 'signin' ? 'signup' : 'signin'))
                      setError('')
                      setNotice('')
                    }}
                  >
                    {emailMode === 'signup' ? 'Sign in' : 'Create an account'}
                  </button>
                </p>
              </form>

              {notice ? (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">{notice}</p>
              ) : null}

              <Button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={disabled}
                variant="outline"
                className="w-full"
              >
                {busy === 'passkey' ? <Loader2 className="animate-spin" /> : <Fingerprint />}
                {busy === 'passkey' ? 'Waiting for passkey…' : 'Continue with a passkey'}
              </Button>

              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Authentication Error</p>
                    <p className="mt-1 text-xs opacity-90">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
      </Card>
    </AuthSplit>
  )
}

function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-background"><Loader2 className="size-8 animate-spin text-primary" /></div>}>
      <LoginPage />
    </Suspense>
  )
}

export default LoginPageWrapper
