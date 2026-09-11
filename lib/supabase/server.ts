import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

/**
 * Server Supabase Client
 * Use this for server-side operations (Server Components, API routes)
 * Automatically handles authentication via cookie headers
 *
 * @returns Supabase client with admin privileges for server operations
 */
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies()

  // Use the modern getAll/setAll interface. This is required for Supabase's
  // *chunked* auth cookies (sb-<ref>-auth-token.0/.1) which passkey/larger
  // sessions produce; the deprecated per-cookie get/set handler fails to
  // reconstruct them in production, causing "No session found".
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component or a GET Route Handler where
            // setting cookies isn't allowed. Safe to ignore: the middleware
            // is responsible for refreshing and persisting the session.
          }
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
  const client = await tryCreateServiceClient()
  if (!client) {
    throw new Error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY')
  }
  return client
}

/**
 * Like createServiceClient, but returns null when the service role key is
 * missing/placeholder instead of throwing. Prefer this in paths that can
 * fall back to the user-session client (local/dev without Sensitive secrets).
 */
export const tryCreateServiceClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    !supabaseServiceKey ||
    supabaseServiceKey.includes('[SENSITIVE]') ||
    supabaseServiceKey === 'your-service-role-key' ||
    !supabaseServiceKey.includes('.')
  ) {
    return null
  }

  // IMPORTANT: do NOT pass the request cookies here. The SSR client would
  // attach the logged-in user's JWT as the Authorization bearer, which
  // downgrades this client to the "authenticated" role and re-enables RLS.
  // A plain client keyed on the service_role secret always runs as service_role.
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${supabaseServiceKey}` },
    },
  })
}

/**
 * Prefer service role; fall back to the signed-in session (local/dev without
 * SUPABASE_SERVICE_ROLE_KEY). Callers must still enforce RBAC.
 */
export async function getAdminDb() {
  const service = await tryCreateServiceClient()
  if (service) return service
  return createSupabaseServerClient()
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