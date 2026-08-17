import { GoogleGenerativeAI } from '@google/generative-ai'

export function getGemini(model = 'gemini-2.0-flash') {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model })
}

export async function geminiJson<T>(prompt: string, model = 'gemini-2.0-flash'): Promise<T> {
  const gem = getGemini(model)
  const result = await gem.generateContent(
    `${prompt}\n\nRespond with valid JSON only. No markdown fences.`
  )
  const text = result.response.text().trim().replace(/^```json\s*|\s*```$/g, '')
  return JSON.parse(text) as T
}

export async function geminiText(prompt: string, model = 'gemini-2.0-flash'): Promise<string> {
  const gem = getGemini(model)
  const result = await gem.generateContent(prompt)
  return result.response.text()
}
