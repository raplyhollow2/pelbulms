import { NextRequest, NextResponse } from 'next/server'
import { getAiKeyStatus } from '@/lib/ai-keys'
import { getFeatureRoutes } from '@/lib/ai/defaults'
import { requireSuperadmin } from '@/lib/ai/require-superadmin'
import {
  AI_FEATURES,
  FEATURE_LABELS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  providersForFeature,
} from '@/lib/ai/models'

/** GET /api/admin/ai/config — superadmin view. Secrets stay on the server. */
export async function GET(request: NextRequest) {
  const auth = await requireSuperadmin(request)
  if (auth.response) return auth.response
  const [status, routes] = await Promise.all([
    getAiKeyStatus(auth.user!.id, true),
    getFeatureRoutes(),
  ])
  return NextResponse.json({
    providers: {
      claude: status.claude,
      gemini: status.gemini,
      chatgpt: status.chatgpt,
      copilot: status.copilot,
    },
    routes,
    labels: PROVIDER_LABELS,
    features: AI_FEATURES.map((id) => ({
      id,
      label: FEATURE_LABELS[id],
      providers: providersForFeature(id),
    })),
    models: PROVIDER_MODELS,
  })
}
