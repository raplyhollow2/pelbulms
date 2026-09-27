import { tryCreateServiceClient } from '@/lib/supabase/server'
import {
  DEFAULT_FEATURE_ROUTES,
  parseFeatureRoutes,
  type AiFeatureRoutes,
} from '@/lib/ai/models'

export async function getFeatureRoutes(): Promise<AiFeatureRoutes> {
  try {
    const service = await tryCreateServiceClient()
    if (!service) return { ...DEFAULT_FEATURE_ROUTES }
    const { data, error } = await (service as any)
      .from('platform_settings')
      .select('ai_feature_routes')
      .eq('id', 'default')
      .maybeSingle()
    if (error || !data) return { ...DEFAULT_FEATURE_ROUTES }
    return parseFeatureRoutes((data as { ai_feature_routes?: unknown }).ai_feature_routes)
  } catch {
    return { ...DEFAULT_FEATURE_ROUTES }
  }
}

export async function saveFeatureRoutes(next: AiFeatureRoutes): Promise<AiFeatureRoutes> {
  const service = await tryCreateServiceClient()
  if (!service) throw new Error('Database is not configured.')
  const parsed = parseFeatureRoutes(next)
  const { error } = await (service as any)
    .from('platform_settings')
    .update({ ai_feature_routes: parsed, updated_at: new Date().toISOString() })
    .eq('id', 'default')
  if (error) throw new Error(error.message)
  return parsed
}
