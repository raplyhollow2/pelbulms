import { generateImage, generateText, Output, zodSchema } from 'ai'
import type { ZodType } from 'zod'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import { resolveAiKeyRecord, type AiKeyMeta } from '@/lib/ai-keys'
import { geminiExtractFromFile, geminiImagePng } from '@/lib/gemini'
import { getFeatureRoutes } from '@/lib/ai/defaults'
import {
  CHATGPT_IMAGE_MODEL,
  FEATURE_LABELS,
  PROVIDER_LABELS,
  modelChain,
  type AiFeature,
  type LlmProvider,
} from '@/lib/ai/models'

export class AiDispatchError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'AiDispatchError'
    this.status = status
  }
}

export type AiRunResult = {
  text: string
  model: string
  provider: LlmProvider
}

type ResolvedLlm = {
  provider: LlmProvider
  secret: string
  meta: AiKeyMeta
}

function notConfigured(provider: LlmProvider, feature?: AiFeature) {
  const where = feature ? `${FEATURE_LABELS[feature]} is assigned to ` : ''
  return new AiDispatchError(
    `${where}${PROVIDER_LABELS[provider]} is not configured. A superadmin can enable it under Admin → AI.`,
    503
  )
}

function normalizeAzureBase(endpoint: string | undefined) {
  let url = String(endpoint || '').trim().replace(/\/+$/, '')
  if (!url) {
    throw new AiDispatchError(
      'Microsoft Copilot needs an Azure endpoint. A superadmin can set it under Admin → AI.',
      503
    )
  }
  if (!/^https:\/\//i.test(url)) url = `https://${url}`
  if (!/\/openai\/v1$/i.test(url)) {
    url = url.replace(/\/openai$/i, '')
    url = `${url}/openai/v1`
  }
  return url
}

export function providerEnabled(meta: AiKeyMeta | undefined, configured: boolean) {
  if (!configured) return false
  return meta?.enabled !== false
}

export async function resolveReadyProvider(provider: LlmProvider): Promise<ResolvedLlm | null> {
  const row = await resolveAiKeyRecord(provider)
  if (!row?.secret || !providerEnabled(row.meta, true)) return null
  if (provider === 'copilot' && !String(row.meta.deployment || row.meta.model || '').trim()) return null
  if (provider === 'copilot' && !String(row.meta.endpoint || '').trim()) return null
  return { provider, secret: row.secret, meta: row.meta }
}

export async function providerForFeature(feature: AiFeature): Promise<ResolvedLlm> {
  const routes = await getFeatureRoutes()
  const provider = routes[feature]
  const ready = await resolveReadyProvider(provider)
  if (!ready) throw notConfigured(provider, feature)
  return ready
}

export async function isFeatureConfigured(feature: AiFeature): Promise<boolean> {
  try {
    await providerForFeature(feature)
    return true
  } catch {
    return false
  }
}

function languageModel(resolved: ResolvedLlm, modelId: string) {
  if (resolved.provider === 'claude') return createAnthropic({ apiKey: resolved.secret })(modelId)
  if (resolved.provider === 'chatgpt') return createOpenAI({ apiKey: resolved.secret })(modelId)
  if (resolved.provider === 'gemini') return createGoogle({ apiKey: resolved.secret })(modelId)
  return createAzure({
    apiKey: resolved.secret,
    baseURL: normalizeAzureBase(resolved.meta.endpoint),
  })(resolved.meta.deployment || modelId)
}

function isRetryable(error: unknown) {
  const msg = String((error as { message?: string })?.message || error || '')
  return /\[(404|429|503|529)\]|not found|no longer available|overloaded|high demand|unavailable|rate limit|RESOURCE_EXHAUSTED|try again/i.test(
    msg
  )
}

async function assertHourlyCap(userId: string | null | undefined, provider: LlmProvider, cap: number | null | undefined) {
  if (!userId || !cap || cap <= 0) return
  const service = await tryCreateServiceClient()
  if (!service) return
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await (service as any)
    .from('ai_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', provider)
    .gte('created_at', since)
  if (error) {
    console.warn('[ai] hourly cap check skipped', error.message)
    return
  }
  if ((count || 0) >= cap) {
    throw new AiDispatchError(
      `${PROVIDER_LABELS[provider]} is limited to ${cap} requests per person each hour. Try again later.`,
      429
    )
  }
}

async function logRun(opts: {
  userId?: string | null
  feature: AiFeature | 'test'
  provider: LlmProvider
  model: string
  audience?: string | null
  inputTokens?: number
  outputTokens?: number
}) {
  if (!opts.userId || opts.feature === 'test') return
  try {
    const service = await tryCreateServiceClient()
    if (!service) return
    await (service as any).from('ai_runs').insert({
      user_id: opts.userId,
      task: opts.feature,
      provider: opts.provider,
      model: opts.model,
      audience: opts.audience || null,
      input_tokens: opts.inputTokens ?? null,
      output_tokens: opts.outputTokens ?? null,
    })
  } catch (error) {
    console.warn('[ai] usage log skipped', error)
  }
}

async function prepare(feature: AiFeature, userId?: string | null) {
  const resolved = await providerForFeature(feature)
  await assertHourlyCap(userId, resolved.provider, resolved.meta.hourlyCap)
  const chain = modelChain(resolved.provider, resolved.meta.model || resolved.meta.deployment)
  if (!chain.length) throw notConfigured(resolved.provider, feature)
  return { resolved, chain }
}

export async function runText(opts: {
  feature: AiFeature
  prompt: string
  system?: string
  userId?: string | null
  audience?: string | null
}): Promise<AiRunResult> {
  const { resolved, chain } = await prepare(opts.feature, opts.userId)
  let lastError: unknown
  for (const modelId of chain) {
    try {
      const result = await generateText({
        model: languageModel(resolved, modelId),
        system: opts.system,
        prompt: opts.prompt,
        maxRetries: 0,
      })
      const text = result.text.trim()
      await logRun({
        userId: opts.userId,
        feature: opts.feature,
        provider: resolved.provider,
        model: modelId,
        audience: opts.audience,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      })
      return { text, model: modelId, provider: resolved.provider }
    } catch (error) {
      lastError = error
      console.warn(`[ai] ${resolved.provider}/${modelId} failed`, error)
      if (!isRetryable(error)) break
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'The model did not respond.'
  throw new AiDispatchError(message, 502)
}

export async function runJsonText<T>(opts: {
  feature: AiFeature
  prompt: string
  system?: string
  userId?: string | null
  audience?: string | null
}): Promise<T> {
  const result = await runText({
    ...opts,
    prompt: `${opts.prompt}\n\nRespond with valid JSON only. No markdown fences.`,
  })
  const text = result.text.trim().replace(/^```json\s*|\s*```$/g, '')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AiDispatchError('The model did not return valid JSON.', 502)
  }
}

export async function runStructured<T>(opts: {
  feature: AiFeature
  schema: ZodType<T>
  prompt: string
  system?: string
  userId?: string | null
  audience?: string | null
}): Promise<{ object: T; model: string; provider: LlmProvider; usage: { inputTokens?: number; outputTokens?: number } }> {
  const { resolved, chain } = await prepare(opts.feature, opts.userId)
  let lastError: unknown
  for (const modelId of chain) {
    try {
      const result = await generateText({
        model: languageModel(resolved, modelId),
        system: opts.system,
        prompt: opts.prompt,
        maxRetries: 0,
        output: Output.object({ schema: zodSchema(opts.schema) }),
      })
      const usage = {
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      }
      await logRun({
        userId: opts.userId,
        feature: opts.feature,
        provider: resolved.provider,
        model: modelId,
        audience: opts.audience,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      })
      return { object: result.output as T, model: modelId, provider: resolved.provider, usage }
    } catch (error) {
      lastError = error
      console.warn(`[ai] ${resolved.provider}/${modelId} failed`, error)
      if (!isRetryable(error)) break
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'The model did not respond.'
  throw new AiDispatchError(message, 502)
}

export async function runImage(opts: { prompt: string; userId?: string | null }): Promise<Buffer> {
  const resolved = await providerForFeature('image')
  if (resolved.provider === 'claude') {
    throw new AiDispatchError('Image generation cannot use Claude. Assign Gemini, ChatGPT, or Copilot.', 400)
  }
  await assertHourlyCap(opts.userId, resolved.provider, resolved.meta.hourlyCap)
  const prompt = `Create a clear educational illustration for an online course. ${opts.prompt}`
  try {
    if (resolved.provider === 'gemini') {
      const png = await geminiImagePng({ apiKey: resolved.secret, prompt })
      if (!png) throw new AiDispatchError('The model did not return an image. Try a more visual prompt.', 400)
      await logRun({
        userId: opts.userId,
        feature: 'image',
        provider: 'gemini',
        model: resolved.meta.model || 'gemini-image',
      })
      return png
    }
    if (resolved.provider === 'copilot' && !resolved.meta.imageDeployment?.trim()) {
      throw new AiDispatchError(
        'Microsoft Copilot needs an image deployment name. A superadmin can set it under Admin → AI.',
        503
      )
    }
    const imageModel =
      resolved.provider === 'chatgpt'
        ? createOpenAI({ apiKey: resolved.secret }).image(CHATGPT_IMAGE_MODEL)
        : createAzure({
            apiKey: resolved.secret,
            baseURL: normalizeAzureBase(resolved.meta.endpoint),
          }).image(resolved.meta.imageDeployment!.trim())
    const result = await generateImage({ model: imageModel, prompt, maxRetries: 0 })
    const bytes = result.image?.uint8Array
    if (!bytes?.length) throw new AiDispatchError('The model did not return an image.', 400)
    await logRun({
      userId: opts.userId,
      feature: 'image',
      provider: resolved.provider,
      model: resolved.provider === 'chatgpt' ? CHATGPT_IMAGE_MODEL : resolved.meta.imageDeployment || 'copilot-image',
    })
    return Buffer.from(bytes)
  } catch (error) {
    if (error instanceof AiDispatchError) throw error
    const message = error instanceof Error ? error.message : 'Image generation failed'
    throw new AiDispatchError(message, 502)
  }
}

export async function runExtract(opts: {
  userId?: string | null
  mimeType: string
  base64: string
  hint?: string
}): Promise<string> {
  const resolved = await providerForFeature('extract')
  await assertHourlyCap(opts.userId, resolved.provider, resolved.meta.hourlyCap)
  const hint =
    opts.hint || 'Extract the full educational text from this source. Preserve headings. Return plain text only.'
  if (resolved.provider === 'gemini') {
    const text = await geminiExtractFromFile({
      apiKey: resolved.secret,
      mimeType: opts.mimeType,
      base64: opts.base64,
      hint,
    })
    await logRun({
      userId: opts.userId,
      feature: 'extract',
      provider: 'gemini',
      model: resolved.meta.model || 'gemini-3.6-flash',
    })
    return text
  }
  const chain = modelChain(resolved.provider, resolved.meta.model || resolved.meta.deployment)
  let lastError: unknown
  for (const modelId of chain) {
    try {
      const result = await generateText({
        model: languageModel(resolved, modelId),
        maxRetries: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: hint },
              {
                type: 'file',
                data: Buffer.from(opts.base64, 'base64'),
                mediaType: opts.mimeType || 'application/octet-stream',
              },
            ],
          },
        ],
      })
      await logRun({
        userId: opts.userId,
        feature: 'extract',
        provider: resolved.provider,
        model: modelId,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      })
      return result.text
    } catch (error) {
      lastError = error
      if (!isRetryable(error)) break
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'Could not extract source'
  throw new AiDispatchError(message, 502)
}

export async function testProvider(provider: LlmProvider): Promise<{ text: string; model: string }> {
  const ready = await resolveReadyProvider(provider)
  if (!ready) throw notConfigured(provider)
  const chain = modelChain(provider, ready.meta.model || ready.meta.deployment)
  if (!chain.length) throw notConfigured(provider)
  let lastError: unknown
  for (const modelId of chain) {
    try {
      const result = await generateText({
        model: languageModel(ready, modelId),
        prompt: 'Reply with the single word OK.',
        maxRetries: 0,
      })
      const text = result.text.trim()
      if (!text) throw new Error('Empty reply')
      return { text, model: modelId }
    } catch (error) {
      lastError = error
      if (!isRetryable(error)) break
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'Connection test failed'
  throw new AiDispatchError(message, 400)
}
