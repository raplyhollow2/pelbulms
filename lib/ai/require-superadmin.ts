import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'
import { resolveEffectiveRole } from '@/lib/approvals-access'

export async function requireSuperadmin(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const service = await createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = resolveEffectiveRole((profile as { role?: string } | null)?.role, user)
  if (role !== 'superadmin') {
    return {
      user: null,
      response: NextResponse.json({ error: 'Only a superadmin can configure AI.' }, { status: 403 }),
    }
  }
  return { user, response: null }
}
