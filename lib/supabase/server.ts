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
export const createSupabaseServerClient = () => {
  const cookieStore = cookies() as any
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
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
  return createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

/**
 * Singleton server client instance
 * Use this for direct imports in server components
 */
let serverClient: ReturnType<typeof createSupabaseServerClient> | null = null

export const getServerClient = () => {
  if (!serverClient) {
    serverClient = createSupabaseServerClient() as any
  }
  return serverClient
}

export default createSupabaseServerClient