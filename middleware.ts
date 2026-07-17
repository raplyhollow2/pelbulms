import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // This response is rebuilt inside setAll so refreshed auth cookies are
  // always attached to what we return.
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

  // IMPORTANT: getUser() validates the token against the Auth server AND
  // refreshes it when needed, writing the new cookies via setAll above.
  // Using getUser (not getSession) is what keeps prod sessions in sync.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname

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

  // Redirect to login if accessing protected route without a session
  if (isProtectedPath && !user) {
    return redirectTo('/auth/login')
  }

  // Redirect to dashboard if accessing auth route with an active session
  if (isAuthPath && user) {
    return redirectTo('/dashboard')
  }

  // Approval status gate from auth metadata (instant, no DB query).
  // Enabled by default for this closed system. Set APPROVAL_GATE_ENABLED=false
  // only as an emergency escape hatch. Accounts with an *undefined* status are
  // treated as legacy and allowed through (page/layout checks still apply),
  // so a missing metadata sync can never hard-lock existing users out.
  const approvalGateEnabled = process.env.APPROVAL_GATE_ENABLED !== 'false'

  if (approvalGateEnabled && isProtectedPath && user) {
    const accountStatus = user.app_metadata?.account_status
    const userRole = user.app_metadata?.role

    // Rejected users -> access denied
    if (accountStatus === 'rejected') {
      return redirectTo('/auth/access-denied')
    }

    // Pending users -> registration form. The form itself forwards users who
    // have already submitted on to /auth/pending-approval, so this both onboards
    // brand-new users and parks those awaiting review.
    if (accountStatus === 'pending') {
      return redirectTo('/auth/register')
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
