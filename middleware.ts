import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // This response is rebuilt inside setAll so refreshed auth cookies are
  // always attached to what we return.
  let res = NextResponse.next({ request: req })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Misconfigured env should never take down every page/API with "Failed to fetch".
  if (!supabaseUrl || !supabaseAnonKey) {
    return res
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        )
      },
    },
    global: {
      // Fail fast when Auth is slow/unreachable so /learn and /api don't hang
      // for 10–40s and surface as browser "Failed to fetch".
      fetch: (input, init) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)
        const upstream = init?.signal
        if (upstream) {
          if (upstream.aborted) controller.abort()
          else upstream.addEventListener('abort', () => controller.abort(), { once: true })
        }
        return fetch(input, { ...init, signal: controller.signal }).finally(() =>
          clearTimeout(timeoutId)
        )
      },
    },
  })

  const pathname = req.nextUrl.pathname

  // IMPORTANT: getUser() validates the token against the Auth server AND
  // refreshes it when needed, writing the new cookies via setAll above.
  // When Auth is unreachable (timeout / offline), NEVER throw — that surfaces
  // in the browser as TypeError: Failed to fetch on every /learn and /api call.
  let user: { id: string; app_metadata?: Record<string, unknown> } | null = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.warn('[middleware] auth.getUser error:', error.message)
      user = null
    } else {
      user = data.user
    }
  } catch (err) {
    console.warn('[middleware] auth.getUser failed; continuing without refresh:', err)
    // Do not call getSession() here — it can re-trigger the same network refresh.
    user = null
  }

  // API routes only need cookie refresh above — do not apply page redirects.
  if (pathname.startsWith('/api/')) {
    return res
  }

  try {
    // Build a redirect that preserves any refreshed auth cookies from `res`.
    const redirectTo = (path: string) => {
      const redirect = NextResponse.redirect(new URL(path, req.url))
      res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      return redirect
    }

    // Protected routes that require authentication
    const protectedPaths = ['/dashboard', '/courses', '/learn', '/teach', '/profile', '/admin']
    const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path))

    // Auth routes that should redirect if already logged in
    const authPaths = ['/auth/login']
    const isAuthPath = authPaths.some((path) => pathname.startsWith(path))

    // Redirect to login if accessing protected route without a session.
    // If Auth timed out but cookies still exist, allow the page through —
    // otherwise brief Supabase outages falsely log everyone out.
    if (isProtectedPath && !user) {
      const hasAuthCookie = req.cookies
        .getAll()
        .some((c) => c.name.includes('auth-token'))
      if (hasAuthCookie) return res
      return redirectTo('/auth/login')
    }

    // Redirect to dashboard if accessing auth route with an active session
    if (isAuthPath && user) {
      return redirectTo('/dashboard')
    }

    // Account status gate: only block rejected/suspended accounts.
    // New users are active immediately; course enrollment is the approval point.
    // Undefined status is treated as legacy and allowed through.
    if (isProtectedPath && user) {
      const accountStatus = user.app_metadata?.account_status
      const userRole = user.app_metadata?.role

      if (accountStatus === 'rejected' || accountStatus === 'suspended') {
        return redirectTo('/auth/access-denied')
      }

      // Role-based access control — only enforced when a role is present in
      // auth metadata. When it's absent (legacy users), page/layout-level
      // checks against the `profiles` table handle authorization instead.
      // Superadmin has top-level access to everything; skip route gating.
      if (userRole && userRole !== 'superadmin') {
        // Assigned reviewers (often instructors) need the approvals screen even
        // though it lives under /admin; the page + API enforce reviewer rights.
        const isApprovalsPath = pathname.startsWith('/admin/approvals')
        if (pathname.startsWith('/admin') && !isApprovalsPath) {
          if (userRole !== 'resource_person' && userRole !== 'admin') {
            return redirectTo('/dashboard')
          }
        }

        if (pathname.startsWith('/teach')) {
          if (userRole !== 'instructor' && userRole !== 'admin' && userRole !== 'resource_person') {
            return redirectTo('/dashboard')
          }
        }
      }
    }

    return res
  } catch (err) {
    console.warn('[middleware] unexpected failure; allowing request:', err)
    return res
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/courses/:path*',
    '/learn/:path*',
    '/teach/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/api/:path*',
  ],
}
