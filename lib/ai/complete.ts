import type { ZodType } from 'zod'
import { runStructured } from '@/lib/ai/dispatch'
import type { AiFeature, LlmProvider } from '@/lib/ai/models'

export type CompleteResult<T> = {
  object: T
  model: string
  provider: LlmProvider
  family: LlmProvider
  usage: { inputTokens?: number; outputTokens?: number }
}

export async function complete<T>(opts: {
  task: Extract<AiFeature, 'report' | 'report-followup' | 'course-structure'>
  schema: ZodType<T>
  prompt: string
  system?: string
  userId?: string | null
  audience?: string | null
}): Promise<CompleteResult<T>> {
  const result = await runStructured({
    feature: opts.task,
    schema: opts.schema,
    prompt: opts.prompt,
    system: opts.system,
    userId: opts.userId,
    audience: opts.audience,
  })
  return {
    object: result.object,
    model: result.model,
    provider: result.provider,
    family: result.provider,
    usage: result.usage,
  }
}
