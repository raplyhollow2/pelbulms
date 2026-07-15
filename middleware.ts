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

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Redirect to dashboard if accessing auth route with active session
  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/courses/:path*', '/learn/:path*', '/teach/:path*', '/profile/:path*', '/admin/:path*', '/auth/:path*']
}