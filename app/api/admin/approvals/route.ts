// @ts-nocheck - Pelsung registration tables/RPCs not fully in generated Database types
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  getApprovalScope,
  resolveEffectiveRole,
} from '@/lib/approvals-access'
import { processRegistrationReview } from '@/lib/approve-registration'

/**
 * Secure API for student registration approvals.
 *
 * Auth uses the user session; data reads/writes use the service client so
 * platform admins are not blocked by institution_access-only RLS policies.
 */

async function loadCaller() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    ) }
  }

  // Prefer service client for profile so RLS can't hide the caller's own row
  let service
  try {
    service = await createServiceClient()
  } catch (e) {
    console.error('[approvals] service client unavailable:', e)
    return {
      error: NextResponse.json(
        {
          error: 'Server misconfigured',
          message: 'Missing SUPABASE_SERVICE_ROLE_KEY',
        },
        { status: 500 }
      ),
    }
  }

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, role, institution_id, email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        {
          error: 'Profile not found',
          message: profileError?.message || 'User profile could not be loaded',
        },
        { status: 404 }
      ),
    }
  }

  const effectiveRole = resolveEffectiveRole(profile.role, user)
  const scope = await getApprovalScope(
    service,
    user.id,
    effectiveRole,
    profile.institution_id
  )

  if (!scope.allowed) {
    return {
      error: NextResponse.json(
        {
          error: 'Forbidden',
          message:
            'You cannot approve registrations. Superadmin/admin see all queues; resource persons and assigned reviewers see their institutes.',
        },
        { status: 403 }
      ),
    }
  }

  return { user, profile, effectiveRole, scope, service, supabase }
}

export async function POST(request: Request) {
  try {
    const loaded = await loadCaller()
    if ('error' in loaded && loaded.error instanceof NextResponse) return loaded.error
    const { user, scope, service } = loaded as any

    const body = await request.json()
    const { action, registrationId, reviewNotes, rejectionReason, registrationIds, assignedRole } =
      body

    if (
      !action ||
      !['approve', 'reject', 'request_info', 'bulk_approve', 'bulk_reject'].includes(action)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid action',
          message:
            'Action must be one of: approve, reject, request_info, bulk_approve, bulk_reject',
        },
        { status: 400 }
      )
    }

    let result

    switch (action) {
      case 'approve':
      case 'reject':
      case 'request_info': {
        if (!registrationId) {
          return NextResponse.json(
            {
              error: 'Missing registration ID',
              message: 'registrationId is required for single approval actions',
            },
            { status: 400 }
          )
        }

        result = await processRegistrationReview(service, {
          registrationId,
          action,
          reviewerId: user.id,
          reviewNotes: reviewNotes || null,
          rejectionReason: rejectionReason || null,
          assignedRole: assignedRole || null,
          scope,
        })

        if (!result.success) {
          return NextResponse.json(
            { error: 'Approval failed', message: result.error },
            { status: 400 }
          )
        }
        break
      }

      case 'bulk_approve':
      case 'bulk_reject': {
        if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
          return NextResponse.json(
            {
              error: 'Missing registration IDs',
              message: 'registrationIds array is required for bulk actions',
            },
            { status: 400 }
          )
        }

        const reviewAction = action === 'bulk_approve' ? 'approve' : 'reject'
        const results = []

        for (const id of registrationIds) {
          const itemResult = await processRegistrationReview(service, {
            registrationId: id,
            action: reviewAction,
            reviewerId: user.id,
            reviewNotes: reviewNotes || null,
            rejectionReason: rejectionReason || null,
            assignedRole: assignedRole || null,
            scope,
          })
          if (!itemResult.success) {
            results.push({ id, error: itemResult.error })
          } else {
            results.push({ id, result: itemResult })
          }
        }

        result = results
        break
      }

      default:
        return NextResponse.json({ error: 'Unhandled action' }, { status: 400 })
    }

    return NextResponse.json({ success: true, result, scope })
  } catch (error: any) {
    console.error('Approval API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error?.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const loaded = await loadCaller()
    if ('error' in loaded && loaded.error instanceof NextResponse) return loaded.error
    const { profile, scope, service } = loaded as any

    const { searchParams } = new URL(request.url)
    const institutionId = searchParams.get('institution_id')
    const status = searchParams.get('status')

    let query = service.from('student_registrations').select('*')

    if (institutionId) {
      if (!scope.isSuper && !scope.institutionIds.includes(institutionId)) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Not assigned to this institution' },
          { status: 403 }
        )
      }
      query = query.eq('institution_id', institutionId)
    } else if (!scope.isSuper) {
      if (!scope.institutionIds.length) {
        return NextResponse.json({
          success: true,
          registrations: [],
          statistics: null,
          scope: { isSuper: false, institutionIds: [] },
        })
      }
      query = query.in('institution_id', scope.institutionIds)
    }

    if (status) {
      query = query.eq('registration_status', status)
    }

    const { data: registrations, error: registrationsError } = await query.order(
      'submitted_at',
      { ascending: false }
    )

    if (registrationsError) {
      console.error('Registrations query error:', registrationsError)
      return NextResponse.json(
        { error: 'Query failed', message: registrationsError.message },
        { status: 500 }
      )
    }

    let stats = null
    if (profile.institution_id) {
      const { data, error: statsError } = await service.rpc('get_institution_stats', {
        target_institution_id: profile.institution_id,
      })
      if (statsError) {
        console.error('Statistics query error:', statsError)
      } else {
        stats = data
      }
    }

    return NextResponse.json({
      success: true,
      registrations: registrations || [],
      statistics: stats,
      scope: {
        isSuper: scope.isSuper,
        institutionIds: scope.isSuper ? null : scope.institutionIds,
      },
      filters: {
        institution_id: institutionId,
        status,
      },
    })
  } catch (error: any) {
    console.error('Approvals GET error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error?.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
