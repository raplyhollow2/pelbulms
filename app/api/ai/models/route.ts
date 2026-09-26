import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/request-user'
import { getAiModelDefaults } from '@/lib/ai/defaults'
import { MODEL_FAMILIES } from '@/lib/ai/models'
import { isAiGatewayConfigured } from '@/lib/ai/complete'

/** GET /api/ai/models — catalog and platform defaults for signed-in users. */
export async function GET(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const defaults = await getAiModelDefaults()
  return NextResponse.json({
    defaults,
    families: MODEL_FAMILIES,
    gatewayConfigured: isAiGatewayConfigured(),
  })
}
