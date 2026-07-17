'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Loader2, AlertCircle, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

// SVG Icons for OAuth providers
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
)

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Check for error in URL parameters
  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      setError(decodeURIComponent(urlError))
    }
  }, [searchParams])

  const handlePasskeySignIn = async () => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data, error: passkeyError } = await supabase.auth.signInWithPasskey()

      if (passkeyError) {
        setError(passkeyError.message)
        setLoading(false)
      } else if (data) {
        // Passkey authentication successful
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Passkey error:', err)
      setError('Passkey authentication failed. Please try again.')
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'facebook' | 'apple' | 'google') => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        setLoading(false)
      } else if (data) {
        // OAuth redirect will happen automatically
      }
    } catch (err) {
      console.error('OAuth error:', err)
      setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} authentication failed. Please try again.`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Brand */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass-strong">
            <BookOpen className="w-8 h-8 text-bhutan-yellow" />
            <span className="text-2xl font-bold bg-gradient-to-r from-bhutan-yellow to-bhutan-orange bg-clip-text text-transparent">
              Pelbu LMS
            </span>
          </div>
          <h1 className="text-3xl font-bold">Welcome to Pelbu LMS</h1>
          <p className="text-muted-foreground">
            Sign in securely with biometrics or security keys
          </p>
        </div>

        {/* OAuth Login */}
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>Sign In to Pelbu LMS</CardTitle>
            <CardDescription>
              Choose your preferred authentication method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Passkey Sign In (Primary) */}
              <Button
                onClick={handlePasskeySignIn}
                disabled={loading}
                className="w-full h-12 bg-bhutan-yellow hover:bg-bhutan-orange transition-colors"
              >
                <Fingerprint className="mr-2 h-5 w-5" />
                {loading ? 'Setting up Passkey...' : 'Continue with Passkey'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* OAuth Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading}
                  variant="outline"
                  className="h-12 hover:bg-gray-100 transition-colors"
                >
                  <GoogleIcon className="h-5 w-5" />
                </Button>
                <Button
                  onClick={() => handleOAuthSignIn('facebook')}
                  disabled={loading}
                  variant="outline"
                  className="h-12 hover:bg-blue-100 transition-colors"
                >
                  <FacebookIcon className="h-5 w-5" />
                </Button>
                <Button
                  onClick={() => handleOAuthSignIn('apple')}
                  disabled={loading}
                  variant="outline"
                  className="h-12 hover:bg-gray-100 transition-colors"
                >
                  <AppleIcon className="h-5 w-5" />
                </Button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-bhutan-yellow" />
                  <span className="ml-2 text-sm text-muted-foreground">Connecting...</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Authentication Error</p>
                    <p className="text-xs mt-1 opacity-90">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Choose Passkey for biometric authentication, or use your preferred social account.</p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Secure authentication powered by Supabase Auth</span>
          </div>
        </div>
      </div>
    </div>
  )
}
// Wrapper component with Suspense boundary
function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" /></div>}>
      <LoginPage />
    </Suspense>
  )
}

export default LoginPageWrapper
