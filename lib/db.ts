import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'

/**
 * Prefer service_role when available; otherwise use the signed-in session.
 * Local/dev often has Sensitive Vercel placeholders for the service key.
 */
export async function getDbClient() {
  return (await tryCreateServiceClient()) || (await createSupabaseServerClient())
}
