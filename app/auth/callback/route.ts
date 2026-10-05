import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  tryCreateServiceClient,
} from '@/lib/supabase/server'
import { resolvePostLoginPath } from '@/lib/auth-destination'

/**
 * Post-login destination: pending KYC stays on the registration wizard;
 * rejected/suspended go to access-denied; approved accounts go to dashboard.
 */
async function destinationFor(userId: string, origin: string): Promise<string> {
  try {
    const db = (await tryCreateServiceClient()) || (await createSupabaseServerClient())
    const path = await resolvePostLoginPath(db, userId)
    return `${origin}${path}`
  } catch {
    return `${origin}/dashboard`
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle errors from Supabase
  if (error) {
    console.error('Supabase auth error:', error, errorDescription)
    return redirectReplacing(
      `${requestUrl.origin}/auth/login?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (e) {
              console.error('Error setting cookie:', e)
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (e) {
              console.error('Error removing cookie:', e)
            }
          },
        },
      }
    )

    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        return redirectReplacing(
          `${requestUrl.origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`
        )
      }

      if (data.session) {
        const next = safeAuthNext(requestUrl.searchParams.get('next'))
        if (next) return redirectReplacing(`${requestUrl.origin}${next}`)
        const destination = await destinationFor(data.session.user.id, requestUrl.origin)
        return redirectReplacing(destination)
      }
    } catch (error) {
      console.error('Auth callback error:', error)
      return redirectReplacing(
        `${requestUrl.origin}/auth/login?error=${encodeURIComponent('Authentication failed')}`
      )
    }
  }

  // If there's no code, redirect to login
  console.log('No code received in callback')
  return redirectReplacing(`${requestUrl.origin}/auth/login?error=no_code`)
}

function redirectReplacing(url: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Continuing</title></head><body><script>location.replace(${JSON.stringify(url)})</script></body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function safeAuthNext(value: string | null) {
  if (value === '/auth/reset-password') return value
  return null
}