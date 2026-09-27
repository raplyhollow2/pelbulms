import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/request-user'
import { getFeatureRoutes } from '@/lib/ai/defaults'
import { isFeatureConfigured } from '@/lib/ai/dispatch'
import { AI_FEATURES, FEATURE_LABELS, PROVIDER_LABELS } from '@/lib/ai/models'

/** GET /api/ai/models — assigned providers for signed-in users. No secrets. */
export async function GET(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const routes = await getFeatureRoutes()
  const configured = Object.fromEntries(
    await Promise.all(
      AI_FEATURES.map(async (feature) => [feature, await isFeatureConfigured(feature)] as const)
    )
  )

  return NextResponse.json({
    routes,
    labels: PROVIDER_LABELS,
    features: FEATURE_LABELS,
    configured,
  })
}
