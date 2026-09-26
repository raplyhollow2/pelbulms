import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'
import { resolveEffectiveRole } from '@/lib/approvals-access'
import { saveAiModelDefaults } from '@/lib/ai/defaults'
import { parseAiModelDefaults } from '@/lib/ai/models'

/** PATCH /api/admin/ai/models — superadmin platform defaults. */
export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = resolveEffectiveRole((profile as { role?: string } | null)?.role, user)
  if (role !== 'superadmin') {
    return NextResponse.json({ error: 'Only a superadmin can change model defaults.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const defaults = parseAiModelDefaults(body)
  try {
    await saveAiModelDefaults(defaults)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save model defaults'
    return NextResponse.json({ error: message }, { status: 500 })
  }
  return NextResponse.json({ defaults })
}
