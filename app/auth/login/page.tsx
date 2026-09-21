'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Loader2, AlertCircle, Fingerprint, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
)

type Busy = null | 'passkey' | SocialProvider

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')
  const [siteName, setSiteName] = useState('Pelbu LMS')

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

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/site')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (typeof data.site_name === 'string' && data.site_name.trim()) {
          setSiteName(data.site_name.trim())
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50 to-white p-4 dark:from-gray-900 dark:to-black">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <Link
            href="/"
            className="glass-strong inline-flex items-center gap-3 rounded-full px-6 py-3 transition-opacity hover:opacity-90"
          >
            <BookOpen className="h-8 w-8 text-bhutan-yellow" />
            <span className="bg-gradient-to-r from-bhutan-yellow to-bhutan-orange bg-clip-text text-2xl font-bold text-transparent">
              {siteName}
            </span>
          </Link>
          <h1 className="text-3xl font-bold">Welcome to {siteName}</h1>
          <p className="text-muted-foreground">
            Sign in with the Google account you use for school or work
          </p>
        </div>

        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>
              Choose a Google account, or another sign-in method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={disabled}
                variant="outline"
                className="h-12 w-full border-border bg-white text-base font-medium text-foreground hover:bg-gray-50 dark:bg-background"
              >
                {busy === 'google' ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <GoogleIcon className="mr-2 h-5 w-5" />
                )}
                Continue with Google
              </Button>

              <Button
                type="button"
                onClick={() => handleOAuthSignIn('facebook')}
                disabled={disabled}
                variant="outline"
                className="h-12 w-full text-base font-medium"
              >
                {busy === 'facebook' ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <FacebookIcon className="mr-2 h-5 w-5" />
                )}
                Continue with Facebook
              </Button>

              <Button
                type="button"
                onClick={() => handleOAuthSignIn('apple')}
                disabled={disabled}
                variant="outline"
                className="h-12 w-full text-base font-medium"
              >
                {busy === 'apple' ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <AppleIcon className="mr-2 h-5 w-5" />
                )}
                Continue with Apple
              </Button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={disabled}
                className="h-12 w-full bg-bhutan-yellow text-base font-medium text-black hover:bg-bhutan-orange"
              >
                {busy === 'passkey' ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Fingerprint className="mr-2 h-5 w-5" />
                )}
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

        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>Google will let you pick which account to use, just like on desktop.</p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            <span>Secure authentication powered by Supabase Auth</span>
          </div>
          <p className="pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs underline underline-offset-4 transition-colors hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" />
              Back to homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" /></div>}>
      <LoginPage />
    </Suspense>
  )
}

export default LoginPageWrapper
