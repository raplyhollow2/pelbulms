import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Server Supabase Client
 * Use this for server-side operations (Server Components, API routes)
 * Automatically handles authentication via cookie headers
 *
 * @returns Supabase client with admin privileges for server operations
 */
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies()

  // Create a stable cookies object for Supabase
  const cookieHandlers = {
    get: (name: string) => {
      const cookie = cookieStore.get(name)
      return cookie?.value
    },
    set: (name: string, value: string, options: any) => {
      try {
        cookieStore.set({
          name,
          value,
          ...options
        })
      } catch (e) {
        // In certain contexts (like API routes), setting cookies might fail silently
        console.error('Error setting cookie:', e)
      }
    },
    remove: (name: string, options: any) => {
      try {
        cookieStore.set({
          name,
          value: '',
          ...options
        })
      } catch (e) {
        console.error('Error removing cookie:', e)
      }
    },
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieHandlers }
  )
}

/**
 * Create a service role client (admin privileges)
 * Use this ONLY for operations that require elevated permissions
 * WARNING: Use sparingly and never expose to client-side code
 */
export const createServiceClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role credentials')
  }

  const cookieStore = await cookies()

  // Create a stable cookies object for Supabase
  const cookieHandlers = {
    get: (name: string) => {
      const cookie = cookieStore.get(name)
      return cookie?.value
    },
    set: (name: string, value: string, options: any) => {
      try {
        cookieStore.set({
          name,
          value,
          ...options
        })
      } catch (e) {
        console.error('Error setting cookie:', e)
      }
    },
    remove: (name: string, options: any) => {
      try {
        cookieStore.set({
          name,
          value: '',
          ...options
        })
      } catch (e) {
        console.error('Error removing cookie:', e)
      }
    },
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    { cookies: cookieHandlers }
  )
}

/**
 * Legacy singleton pattern - deprecated
 * Use createSupabaseServerClient or createServiceClient instead
 * @deprecated Use the async factory functions instead
 */
export const getServerClient = () => {
  throw new Error(
    'getServerClient is deprecated. Use createSupabaseServerClient() or createServiceClient() instead.'
  )
}

export default createSupabaseServerClient