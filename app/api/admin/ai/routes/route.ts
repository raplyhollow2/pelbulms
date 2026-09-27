import { NextRequest, NextResponse } from 'next/server'
import { saveFeatureRoutes } from '@/lib/ai/defaults'
import { requireSuperadmin } from '@/lib/ai/require-superadmin'
import {
  AI_FEATURES,
  FEATURE_LABELS,
  isLlmProvider,
  providersForFeature,
  type AiFeature,
} from '@/lib/ai/models'

/** PATCH /api/admin/ai/routes — assign each feature to one enabled provider. */
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const raw = body.routes && typeof body.routes === 'object' ? body.routes : body
  for (const feature of AI_FEATURES) {
    const value = (raw as Record<string, unknown>)[feature]
    if (!isLlmProvider(value) || !providersForFeature(feature as AiFeature).includes(value)) {
      return NextResponse.json(
        { error: `${FEATURE_LABELS[feature]} needs one of: ${providersForFeature(feature).join(', ')}.` },
        { status: 400 }
      )
    }
  }

  try {
    const routes = await saveFeatureRoutes(raw)
    return NextResponse.json({ routes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save feature routing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
