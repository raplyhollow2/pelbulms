// @ts-nocheck - Pelsung registration tables/RPCs not fully in generated Database types
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  getApprovalScope,
  resolveEffectiveRole,
} from '@/lib/approvals-access'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

type ProfileWithEmail = Profile & {
  email?: string
  institution_id?: string
}

/**
 * Secure API for student registration approvals.
 *
 * Access model (enterprise / online LMS):
 * - superadmin: all institutes
 * - active registration_reviewers assignee: only their assigned institutes
 * Teachers are NOT auto-granted access — assign them on /admin/reviewers.
 */

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, institution_id, email, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found', message: 'User profile could not be loaded' },
        { status: 404 }
      )
    }

    const safeProfile = profile as ProfileWithEmail
    const effectiveRole = resolveEffectiveRole(safeProfile.role, user)
    const scope = await getApprovalScope(
      supabase,
      user.id,
      effectiveRole,
      safeProfile.institution_id
    )

    if (!scope.allowed) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message:
            'You cannot approve registrations. Superadmin and resource persons see their queues; other users must be assigned on Reviewers.',
        },
        { status: 403 }
      )
    }

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

        const { data: approvalResult, error: approvalError } = await supabase.rpc(
          'approve_student_registration',
          {
            target_registration_id: registrationId,
            review_action: action,
            review_notes_text: reviewNotes || null,
            rejection_reason_text: rejectionReason || null,
            assigned_role_text: assignedRole || null,
          }
        )

        if (approvalError) {
          console.error('Approval function error:', approvalError)
          return NextResponse.json(
            { error: 'Approval failed', message: approvalError.message },
            { status: 500 }
          )
        }

        result = approvalResult
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
          const { data, error } = await supabase.rpc('approve_student_registration', {
            target_registration_id: id,
            review_action: reviewAction,
            review_notes_text: reviewNotes || null,
            rejection_reason_text: rejectionReason || null,
            assigned_role_text: assignedRole || null,
          })
          if (error) {
            results.push({ id, error: error.message })
          } else {
            results.push({ id, result: data })
          }
        }

        result = results
        break
      }

      default:
        return NextResponse.json({ error: 'Unhandled action' }, { status: 400 })
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Approval API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found', message: 'User profile could not be loaded' },
        { status: 404 }
      )
    }

    const safeProfile = profile as ProfileWithEmail
    const effectiveRole = resolveEffectiveRole(safeProfile.role, user)
    const scope = await getApprovalScope(
      supabase,
      user.id,
      effectiveRole,
      safeProfile.institution_id
    )

    if (!scope.allowed) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message:
            'You cannot approve registrations. Superadmin and resource persons see their queues; other users must be assigned on Reviewers.',
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const institutionId = searchParams.get('institution_id')
    const status = searchParams.get('status')

    let query = supabase.from('student_registrations').select('*')

    if (institutionId) {
      if (!scope.isSuper && !scope.institutionIds.includes(institutionId)) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Not assigned to this institution' },
          { status: 403 }
        )
      }
      query = query.eq('institution_id', institutionId)
    } else if (!scope.isSuper) {
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

    const { data: stats, error: statsError } = await supabase.rpc('get_institution_stats', {
      target_institution_id: safeProfile.institution_id,
    })

    if (statsError) {
      console.error('Statistics query error:', statsError)
    }

    return NextResponse.json({
      success: true,
      registrations: registrations || [],
      statistics: stats || null,
      scope: {
        isSuper: scope.isSuper,
        institutionIds: scope.isSuper ? null : scope.institutionIds,
      },
      filters: {
        institution_id: institutionId,
        status,
      },
    })
  } catch (error) {
    console.error('Approvals GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
