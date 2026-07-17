import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Create a Supabase client configured for Middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()

  // Protected routes that require authentication
  const protectedPaths = ['/dashboard', '/courses', '/learn', '/teach', '/profile', '/admin']
  const isProtectedPath = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path))

  // Auth routes that should redirect if already logged in
  const authPaths = ['/auth/login']
  const isAuthPath = authPaths.some(path => req.nextUrl.pathname.startsWith(path))

  // Public routes (no authentication required)
  const publicPaths = ['/']
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname === path)

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Redirect to dashboard if accessing auth route with active session
  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Approval status gate from auth metadata (instant, no DB query).
  // Disabled by default: the approval workflow isn't fully built yet, and the
  // metadata sync trigger stamps existing accounts as `pending`, locking real
  // users (incl. admins) out of the live app. Set APPROVAL_GATE_ENABLED=true
  // once every active account has account_status='active' synced.
  const approvalGateEnabled = process.env.APPROVAL_GATE_ENABLED === 'true'

  if (approvalGateEnabled && isProtectedPath && session) {
    const accountStatus = session.user.app_metadata?.account_status
    const userRole = session.user.app_metadata?.role

    // Rejected users -> access denied
    if (accountStatus === 'rejected') {
      return NextResponse.redirect(new URL('/auth/access-denied', req.url))
    }

    // Pending users -> approval page (allow completing registration)
    if (accountStatus === 'pending') {
      if (req.nextUrl.pathname.startsWith('/auth/register')) {
        return res
      }
      return NextResponse.redirect(new URL('/auth/pending-approval', req.url))
    }

    // Role-based access control — only enforced when a role is present in
    // auth metadata. When it's absent (legacy users), page/layout-level
    // checks against the `profiles` table handle authorization instead.
    // Superadmin has top-level access to everything; skip route gating.
    if (userRole && userRole !== 'superadmin') {
      const pathname = req.nextUrl.pathname

      if (pathname.startsWith('/admin')) {
        if (userRole !== 'resource_person' && userRole !== 'admin') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }

      if (pathname.startsWith('/teach')) {
        if (userRole !== 'instructor' && userRole !== 'admin' && userRole !== 'resource_person') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }
    }
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/courses/:path*', '/learn/:path*', '/teach/:path*', '/profile/:path*', '/admin/:path*', '/auth/:path*']
}