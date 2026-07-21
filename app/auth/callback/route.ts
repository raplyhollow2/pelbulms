import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Decide where a freshly-authenticated user should land based on their
 * account status and whether they've completed the KYC registration form.
 */
async function destinationFor(userId: string, origin: string): Promise<string> {
  try {
    const service = await createServiceClient()

    const { data: profile } = await service
      .from('profiles')
      .select('account_status')
      .eq('id', userId)
      .maybeSingle()

    const status = (profile as any)?.account_status as string | undefined

    if (status === 'active') return `${origin}/dashboard`
    if (status === 'rejected') return `${origin}/auth/access-denied`

    // Pending / unknown: has the user already submitted a registration?
    const { data: registration } = await service
      .from('student_registrations')
      .select('registration_status')
      .eq('user_id', userId)
      .maybeSingle()

    const regStatus = (registration as any)?.registration_status as string | undefined
    if (regStatus && ['submitted', 'under_review', 'additional_info_requested'].includes(regStatus)) {
      return `${origin}/auth/pending-approval`
    }

    return `${origin}/auth/register`
  } catch {
    // If the status lookup fails, fall back to the gated dashboard; middleware
    // will re-route as needed.
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
    return NextResponse.redirect(
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
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`
        )
      }

      if (data.session) {
        const destination = await destinationFor(data.session.user.id, requestUrl.origin)
        return NextResponse.redirect(destination)
      }
    } catch (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/login?error=${encodeURIComponent('Authentication failed')}`
      )
    }
  }

  // If there's no code, redirect to login
  console.log('No code received in callback')
  return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=no_code`)
}