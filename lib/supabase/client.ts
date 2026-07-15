import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

/**
 * Browser Supabase Client
 * Use this for client-side operations (React components, hooks)
 * Handles authentication state automatically via cookies
 */
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        experimental: {
          passkey: true // Enable Passkey/WebAuthn authentication
        }
      }
    }
  )
}

/**
 * Singleton browser client instance
 * Use this for direct imports in client components
 */
let browserClient: ReturnType<typeof createClient> | null = null

export const getBrowserClient = () => {
  if (!browserClient) {
    browserClient = createClient()
  }
  return browserClient
}

// Convenience export for React components
export default createClient