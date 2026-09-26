import { generateText, Output, zodSchema } from 'ai'
import type { ZodType } from 'zod'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import {
  defaultFamilyForTask,
  familyOfModel,
  modelChain,
  type AiTask,
  type ModelFamily,
} from '@/lib/ai/models'
import { getAiModelDefaults } from '@/lib/ai/defaults'

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === '1')
}

export type CompleteResult<T> = {
  object: T
  model: string
  family: ModelFamily
  usage: { inputTokens?: number; outputTokens?: number }
}

async function logRun(opts: {
  userId?: string | null
  task: AiTask
  model: string
  audience?: string | null
  inputTokens?: number
  outputTokens?: number
}) {
  if (!opts.userId) return
  try {
    const service = await tryCreateServiceClient()
    if (!service) return
    await (service as any).from('ai_runs').insert({
      user_id: opts.userId,
      task: opts.task,
      model: opts.model,
      audience: opts.audience || null,
      input_tokens: opts.inputTokens ?? null,
      output_tokens: opts.outputTokens ?? null,
    })
  } catch (error) {
    console.warn('[ai/complete] usage log skipped', error)
  }
}

export async function complete<T>(opts: {
  task: AiTask
  schema: ZodType<T>
  prompt: string
  system?: string
  family?: ModelFamily
  userId?: string | null
  audience?: string | null
}): Promise<CompleteResult<T>> {
  if (!isAiGatewayConfigured()) {
    const err = new Error(
      'AI Gateway is not configured. Set AI_GATEWAY_API_KEY (or deploy with Vercel OIDC) to use Claude, ChatGPT, and Gemini.'
    )
    ;(err as { status?: number }).status = 503
    throw err
  }

  const defaults = await getAiModelDefaults()
  const family = opts.family || defaultFamilyForTask(opts.task, defaults)
  const chain = modelChain(opts.task, family)
  let lastError: unknown

  for (const model of chain) {
    try {
      const result = await generateText({
        model,
        system: opts.system,
        prompt: opts.prompt,
        maxRetries: 0,
        output: Output.object({ schema: zodSchema(opts.schema) }),
      })
      const usage = {
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      }
      const answered = familyOfModel(model)
      await logRun({
        userId: opts.userId,
        task: opts.task,
        model,
        audience: opts.audience,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      })
      return {
        object: result.output as T,
        model,
        family: answered,
        usage,
      }
    } catch (error) {
      lastError = error
      console.warn(`[ai/complete] ${model} failed`, error)
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'The model did not respond.'
  const err = new Error(message)
  ;(err as { status?: number }).status = 502
  throw err
}
