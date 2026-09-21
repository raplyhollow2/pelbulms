'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { completeGoogleIdToken } from '@/lib/oauth'

export default function NativeGooglePage() {
  const [error, setError] = useState('')

  useEffect(() => {
    const token = window.PelbuNativeAuth?.pendingGoogleIdToken?.() || ''
    if (!token) {
      setError('Google sign-in did not return an account. Go back and try again.')
      return
    }
    void completeGoogleIdToken(token).catch((err) => {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
    })
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
      {error ? (
        <p className="max-w-sm text-center text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
          <p className="text-sm text-muted-foreground">Signing you in with Google…</p>
        </>
      )}
    </div>
  )
}
