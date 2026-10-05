import { GoogleGenerativeAI } from '@google/generative-ai'

export const GEMINI_TEXT_MODEL = 'gemini-3.6-flash'
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'

/** Prefer 3.6; fall back when Google returns 503 high demand or 404 retired models. */
export const GEMINI_TEXT_FALLBACKS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
]

const GEMINI_IMAGE_FALLBACKS = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image']

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorText(err: unknown) {
  return String((err as any)?.message || err || '')
}

function isBusy(err: unknown) {
  const msg = errorText(err)
  return /\[503\]|\[429\]|high demand|unavailable|RESOURCE_EXHAUSTED|overloaded|try again later/i.test(msg)
}

function isMissingModel(err: unknown) {
  const msg = errorText(err)
  return /\[404\]|no longer available|not found|is not found/i.test(msg)
}

export function friendlyImageError(message: string) {
  if (/quota|rate.?limit|limit:\s*0|Too Many Requests|RESOURCE_EXHAUSTED/i.test(message)) {
    return 'Image generation is unavailable. This Google key has no image quota left. Add a picture with an image URL, or try again after the quota resets.'
  }
  if (/\[503\]|high demand|unavailable|overloaded/i.test(message)) {
    return 'Image generation is busy right now. Wait a moment and try again.'
  }
  if (message.length > 180 || /GoogleGenerativeAI|googleapis/i.test(message)) {
    return 'Could not generate that image. Try again in a little while, or add a picture with an image URL.'
  }
  return message || 'Could not generate that image.'
}

function clientFor(apiKey: string) {
  const key = apiKey.trim()
  if (!key) throw new Error('Gemini API key is not configured.')
  return new GoogleGenerativeAI(key)
}

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  models: string[],
  request: Parameters<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>[0]
) {
  let lastError: unknown
  for (const model of models) {
    const gem = genAI.getGenerativeModel({ model })
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await gem.generateContent(request)
      } catch (err) {
        lastError = err
        if (isMissingModel(err)) break
        if (isBusy(err) && attempt < 2) {
          await sleep(700 * (attempt + 1))
          continue
        }
        if (isBusy(err)) break
        throw err
      }
    }
  }
  const msg = errorText(lastError)
  if (isBusy(lastError)) {
    throw new Error(
      'Gemini is busy right now (high demand). Wait a few seconds and try again — Rigbu already retried other Flash models.'
    )
  }
  throw lastError instanceof Error ? lastError : new Error(msg || 'Gemini request failed')
}

function textModelList(preferred?: string) {
  const first = preferred || GEMINI_TEXT_MODEL
  return [first, ...GEMINI_TEXT_FALLBACKS.filter((m) => m !== first)]
}

export async function geminiExtractFromFile(opts: {
  apiKey: string
  mimeType: string
  base64: string
  hint?: string
}): Promise<string> {
  const genAI = clientFor(opts.apiKey)
  const result = await generateWithFallback(genAI, textModelList(), [
    {
      text:
        opts.hint ||
        'Extract the full educational text from this source. Preserve headings. Return plain text only.',
    },
    {
      inlineData: {
        mimeType: opts.mimeType,
        data: opts.base64,
      },
    },
  ])
  return result.response.text()
}

export async function geminiImagePng(opts: {
  apiKey: string
  prompt: string
}): Promise<Buffer | null> {
  const genAI = clientFor(opts.apiKey)
  let lastError: unknown
  for (const modelName of GEMINI_IMAGE_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          // @ts-expect-error image modality supported by Gemini image models
          responseModalities: ['IMAGE', 'TEXT'],
        },
      })
      const result = await model.generateContent(
        `Create a clear educational illustration for an online course. ${opts.prompt}`
      )
      const parts = result.response.candidates?.[0]?.content?.parts || []
      for (const part of parts as any[]) {
        const data = part.inlineData?.data || part.inline_data?.data
        if (data) return Buffer.from(data, 'base64')
      }
      return null
    } catch (err) {
      lastError = err
      if (isBusy(err)) {
        await sleep(800)
        continue
      }
      if (isMissingModel(err)) continue
      throw err
    }
  }
  throw new Error(friendlyImageError(errorText(lastError)))
}

export async function pingGeminiKey(secret: string) {
  const genAI = clientFor(secret)
  await generateWithFallback(genAI, textModelList(), 'Reply with the single word OK.')
}
