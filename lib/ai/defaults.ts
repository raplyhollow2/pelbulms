import { tryCreateServiceClient } from '@/lib/supabase/server'
import {
  DEFAULT_AI_MODEL_DEFAULTS,
  parseAiModelDefaults,
  type AiModelDefaults,
} from '@/lib/ai/models'

export async function getAiModelDefaults(): Promise<AiModelDefaults> {
  try {
    const service = await tryCreateServiceClient()
    if (!service) return { ...DEFAULT_AI_MODEL_DEFAULTS }
    const { data, error } = await (service as any)
      .from('platform_settings')
      .select('ai_model_defaults')
      .eq('id', 'default')
      .maybeSingle()
    if (error || !data) return { ...DEFAULT_AI_MODEL_DEFAULTS }
    return parseAiModelDefaults((data as { ai_model_defaults?: unknown }).ai_model_defaults)
  } catch {
    return { ...DEFAULT_AI_MODEL_DEFAULTS }
  }
}

export async function saveAiModelDefaults(next: AiModelDefaults): Promise<void> {
  const service = await tryCreateServiceClient()
  if (!service) throw new Error('Database is not configured.')
  const parsed = parseAiModelDefaults(next)
  const { error } = await (service as any)
    .from('platform_settings')
    .update({ ai_model_defaults: parsed, updated_at: new Date().toISOString() })
    .eq('id', 'default')
  if (error) throw new Error(error.message)
}
