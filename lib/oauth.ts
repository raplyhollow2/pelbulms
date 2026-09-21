'use client'

import { createClient } from '@/lib/supabase/client'

export type SocialProvider = 'google' | 'facebook' | 'apple'

declare global {
  interface Window {
    PelbuNativeAuth?: {
      openOAuth: (url: string) => void
      signInWithGoogle: () => void
      pendingGoogleIdToken: () => string
    }
    __pelbuCompleteNativeGoogle?: (idToken: string) => void
  }
}

export function isPelbuAndroidWebView() {
  if (typeof navigator === 'undefined') return false
  return /PelbuLMS\//.test(navigator.userAgent) && /Android/i.test(navigator.userAgent)
}

function queryParamsFor(provider: SocialProvider): Record<string, string> | undefined {
  if (provider !== 'google') return undefined
  return {
    prompt: 'select_account',
    access_type: 'offline',
  }
}

export async function completeGoogleIdToken(idToken: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  })
  if (error) throw error
  window.location.assign('/dashboard')
}

/** Lets the Android app hand a Google ID token back into this page. */
export function registerNativeGoogleCompletion(
  onError: (message: string) => void
) {
  window.__pelbuCompleteNativeGoogle = (idToken: string) => {
    void completeGoogleIdToken(idToken).catch((err) => {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.'
      onError(message)
    })
  }
  return () => {
    delete window.__pelbuCompleteNativeGoogle
  }
}

/**
 * Start a social sign-in as a top-level navigation (never a popup).
 * On the Android app, Google uses the system account picker.
 */
export async function startSocialOAuth(provider: SocialProvider) {
  if (
    provider === 'google' &&
    isPelbuAndroidWebView() &&
    typeof window.PelbuNativeAuth?.signInWithGoogle === 'function'
  ) {
    window.PelbuNativeAuth.signInWithGoogle()
    return
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      skipBrowserRedirect: true,
      queryParams: queryParamsFor(provider),
    },
  })

  if (error) throw error
  if (!data.url) {
    throw new Error('Could not start sign-in. Please try again.')
  }

  if (isPelbuAndroidWebView() && typeof window.PelbuNativeAuth?.openOAuth === 'function') {
    window.PelbuNativeAuth.openOAuth(data.url)
    return
  }

  window.location.assign(data.url)
}
