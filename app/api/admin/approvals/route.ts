// @ts-nocheck - Pelsung registration tables/RPCs not fully in generated Database types
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

// Extended profile type with additional fields from the query
type ProfileWithEmail = Profile & {
  email?: string
  institution_id?: string
}

/**
 * Secure API Route for Student Registration Approvals
 *
 * This is the ONLY endpoint that should handle approval operations.
 * All client-side components must call this API instead of direct DB operations.
 *
 * Security Features:
 * - Server-side validation of user permissions
 * - Calls secure RPC functions with SECURITY DEFINER
 * - No direct database writes from client-side
 * - Comprehensive audit logging
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

    // Get user profile to check permissions
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

    // Type guard to ensure profile exists
    const safeProfile = profile as ProfileWithEmail

    // Verify admin/teacher permissions
    if (!['resource_person', 'admin', 'instructor'].includes(safeProfile.role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions for approval operations' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { action, registrationId, userId, reviewNotes, rejectionReason, registrationIds } = body

    // Validate action parameter
    if (!action || !['approve', 'reject', 'request_info', 'bulk_approve', 'bulk_reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action', message: 'Action must be one of: approve, reject, request_info, bulk_approve, bulk_reject' },
        { status: 400 }
      )
    }

    let result

    // Handle different action types
    switch (action) {
      case 'approve':
      case 'reject':
      case 'request_info':
        // Single registration approval/rejection
        if (!registrationId) {
          return NextResponse.json(
            { error: 'Missing registration ID', message: 'registrationId is required for single approval actions' },
            { status: 400 }
          )
        }

        // Call the secure RPC function
        const { data: approvalResult, error: approvalError } = await supabase
          // @ts-ignore - RPC function types not properly defined in Supabase types
          .rpc('approve_student_registration', {
            target_registration_id: registrationId,
            review_action: action,
            review_notes_text: reviewNotes || null,
            rejection_reason_text: rejectionReason || null
          })

        if (approvalError) {
          console.error('Approval function error:', approvalError)
          return NextResponse.json(
            { error: 'Approval failed', message: approvalError.message },
            { status: 500 }
          )
        }

        result = approvalResult
        break

      case 'bulk_approve':
      case 'bulk_reject':
        // Bulk approval operations
        if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
          return NextResponse.json(
            { error: 'Missing registration IDs', message: 'registrationIds array is required for bulk operations' },
            { status: 400 }
          )
        }

        // Call the bulk approval RPC function
        const { data: bulkResult, error: bulkError } = await supabase
          // @ts-ignore - RPC function types not properly defined in Supabase types
          .rpc('bulk_approve_registrations', {
            registration_ids: registrationIds,
            review_action: action === 'bulk_approve' ? 'approve' : 'reject',
            review_notes_text: reviewNotes || null
          })

        if (bulkError) {
          console.error('Bulk approval error:', bulkError)
          return NextResponse.json(
            { error: 'Bulk approval failed', message: bulkError.message },
            { status: 500 }
          )
        }

        result = bulkResult
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action', message: 'Unknown action type' },
          { status: 400 }
        )
    }

    // Log the approval action for audit purposes
    console.log(`Approval action completed:`, {
      action,
      performedBy: safeProfile.email,
      performerRole: safeProfile.role,
      timestamp: new Date().toISOString(),
      result: result
    })

    return NextResponse.json({
      success: true,
      message: `Operation completed successfully`,
      action,
      performedBy: {
        email: safeProfile.email,
        name: safeProfile.full_name,
        role: safeProfile.role
      },
      result
    })

  } catch (error) {
    console.error('Approval API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for retrieving approval statistics
 */
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

    // Get user profile to check permissions
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

    // Type guard to ensure profile exists
    const safeProfile = profile as ProfileWithEmail

    // Verify admin/teacher permissions
    if (!['resource_person', 'admin', 'instructor'].includes(safeProfile.role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get URL parameters for filtering
    const { searchParams } = new URL(request.url)
    const institutionId = searchParams.get('institution_id') || safeProfile.institution_id
    const status = searchParams.get('status')

    // Build query for registrations
    let query = supabase
      .from('student_registrations')
      .select('*')

    // Apply filters
    if (institutionId) {
      query = query.eq('institution_id', institutionId)
    }

    if (status) {
      query = query.eq('registration_status', status)
    }

    // Only teachers can see their institution's registrations
    if (safeProfile.role === 'instructor') {
      query = query.eq('institution_id', safeProfile.institution_id)
    }

    const { data: registrations, error: registrationsError } = await query
      .order('submitted_at', { ascending: false })

    if (registrationsError) {
      console.error('Registrations query error:', registrationsError)
      return NextResponse.json(
        { error: 'Query failed', message: registrationsError.message },
        { status: 500 }
      )
    }

    // Get institution statistics
    const { data: stats, error: statsError } = await supabase
      // @ts-ignore - RPC function types not properly defined in Supabase types
      .rpc('get_institution_stats', {
        target_institution_id: safeProfile.institution_id
      })

    if (statsError) {
      console.error('Statistics query error:', statsError)
    }

    return NextResponse.json({
      success: true,
      registrations: registrations || [],
      statistics: stats || null,
      filters: {
        institution_id: institutionId,
        status: status
      }
    })

  } catch (error) {
    console.error('Approvals GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}