'use client'

import { useEffect, useState } from 'react'
import { completeGoogleIdToken } from '@/lib/oauth'
import { RigbuLoader } from '@/components/brand/rigbu'

export default function NativeGooglePage() {
  const [error, setError] = useState('')

  useEffect(() => {
    const token = window.RigbuNativeAuth?.pendingGoogleIdToken?.() || ''
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
          <RigbuLoader label="Signing you in with Google…" />
        </>
      )}
    </div>
  )
}
