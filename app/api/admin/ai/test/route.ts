import { NextRequest, NextResponse } from 'next/server'
import { AiDispatchError, testProvider } from '@/lib/ai/dispatch'
import { requireSuperadmin } from '@/lib/ai/require-superadmin'
import { isLlmProvider, type LlmProvider } from '@/lib/ai/models'

/** POST /api/admin/ai/test — send a one-word prompt to a saved provider. */
export async function POST(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const provider = body.provider as LlmProvider
  if (!isLlmProvider(provider)) {
    return NextResponse.json({ error: 'Choose a provider to test.' }, { status: 400 })
  }

  try {
    const result = await testProvider(provider)
    return NextResponse.json({ ok: true, provider, model: result.model, reply: result.text.slice(0, 80) })
  } catch (error) {
    const status = error instanceof AiDispatchError ? error.status : 400
    const message = error instanceof Error ? error.message : 'Connection test failed'
    return NextResponse.json({ error: message }, { status })
  }
}
