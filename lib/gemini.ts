import { GoogleGenerativeAI } from '@google/generative-ai'
import { resolveAiKey } from '@/lib/ai-keys'

export const GEMINI_TEXT_MODEL = 'gemini-3.6-flash'
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'

export async function getGemini(model = GEMINI_TEXT_MODEL, userId?: string | null) {
  const key = await resolveAiKey('gemini', userId)
  if (!key) {
    throw new Error(
      'Gemini API key is not configured. Add one in Settings → AI or ask an admin to save a platform key.'
    )
  }
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model })
}

export async function geminiJson<T>(
  prompt: string,
  opts?: { model?: string; userId?: string | null }
): Promise<T> {
  const gem = await getGemini(opts?.model || GEMINI_TEXT_MODEL, opts?.userId)
  const result = await gem.generateContent(
    `${prompt}\n\nRespond with valid JSON only. No markdown fences.`
  )
  const text = result.response.text().trim().replace(/^```json\s*|\s*```$/g, '')
  return JSON.parse(text) as T
}

export async function geminiText(
  prompt: string,
  opts?: { model?: string; userId?: string | null }
): Promise<string> {
  const gem = await getGemini(opts?.model || GEMINI_TEXT_MODEL, opts?.userId)
  const result = await gem.generateContent(prompt)
  return result.response.text()
}

export async function geminiExtractFromFile(opts: {
  userId?: string | null
  mimeType: string
  base64: string
  hint?: string
}): Promise<string> {
  const gem = await getGemini(GEMINI_TEXT_MODEL, opts.userId)
  const result = await gem.generateContent([
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
  userId?: string | null
  prompt: string
}): Promise<Buffer | null> {
  const key = await resolveAiKey('gemini', opts.userId)
  if (!key) throw new Error('Gemini API key is not configured')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: GEMINI_IMAGE_MODEL,
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
}
