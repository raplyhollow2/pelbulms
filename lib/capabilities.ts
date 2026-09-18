/**
 * Platform capability catalog + resolver (Phase 1 admin permissions).
 *
 * Capabilities live in DB (`capabilities` / `role_capabilities`). Superadmin
 * always has every capability. Institution scope comes from `roles.all_institutions`
 * + `role_institutions`.
 */
// @ts-nocheck - roles/capabilities tables not yet in generated Database types

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/roles'

/** Avoid importing rbac.ts here (circular: rbac re-exports this module). */
const SUPERADMIN_ROLE: UserRole = 'superadmin'

type RBACCheck = {
  hasAccess: boolean
  userRole?: UserRole
  userId?: string
  error?: string
}

export type CapabilityKey = string

export type CapabilityAction =
  | 'view'
  | 'add'
  | 'edit'
  | 'delete'
  | 'configure'
  | 'uninstall'

export type CapabilityGroup = 'menu' | 'module'

/** Stable keys used by APIs and the permissions UI. */
export const CAP = {
  DASHBOARD_VIEW: 'admin.dashboard.view',
  USERS_VIEW: 'admin.users.view',
  USERS_ADD: 'admin.users.add',
  USERS_EDIT: 'admin.users.edit',
  USERS_DELETE: 'admin.users.delete',
  APPROVALS_VIEW: 'admin.approvals.view',
  APPROVALS_EDIT: 'admin.approvals.edit',
  REVIEWERS_VIEW: 'admin.reviewers.view',
  REVIEWERS_ADD: 'admin.reviewers.add',
  REVIEWERS_EDIT: 'admin.reviewers.edit',
  REVIEWERS_DELETE: 'admin.reviewers.delete',
  REPORTS_VIEW: 'admin.reports.view',
  INSTITUTIONS_VIEW: 'admin.institutions.view',
  INSTITUTIONS_ADD: 'admin.institutions.add',
  INSTITUTIONS_EDIT: 'admin.institutions.edit',
  INSTITUTIONS_DELETE: 'admin.institutions.delete',
  SETTINGS_VIEW: 'admin.settings.view',
  SETTINGS_EDIT: 'admin.settings.edit',
  PERMISSIONS_VIEW: 'admin.permissions.view',
  PERMISSIONS_EDIT: 'admin.permissions.edit',
  AI_VIEW: 'admin.ai.view',
  AI_CONFIGURE: 'admin.ai.configure',
} as const

export type ResolvedCapabilities = {
  userId: string
  userRole: UserRole
  roleId: string | null
  roleSlug: string | null
  baseArchetype: UserRole
  /** Empty set means allow-all when allInstitutions is true; otherwise empty = no institutions. */
  capabilityKeys: Set<string>
  allInstitutions: boolean
  institutionIds: string[]
}

export type CapabilityCheck = RBACCheck & {
  capabilities?: ResolvedCapabilities
}

type AdminDb = Awaited<ReturnType<typeof tryCreateServiceClient>> | null

async function getDb() {
  const service = await tryCreateServiceClient()
  if (service) return service
  return createSupabaseServerClient()
}

/**
 * Resolve capability grants for a user. Falls back to coarse-role defaults when
 * the roles tables are missing / empty (pre-migration).
 */
export async function resolveUserCapabilities(
  userId: string,
  fallbackRole?: UserRole | null
): Promise<ResolvedCapabilities> {
  const supabase = await getDb()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, role_id')
    .eq('id', userId)
    .maybeSingle()

  const userRole = ((profile as any)?.role || fallbackRole || 'student') as UserRole
  const roleId = ((profile as any)?.role_id as string | null) || null

  // Superadmin: implicit allow-all
  if (userRole === SUPERADMIN_ROLE) {
    return {
      userId,
      userRole,
      roleId,
      roleSlug: 'superadmin',
      baseArchetype: 'superadmin',
      capabilityKeys: new Set(['*']),
      allInstitutions: true,
      institutionIds: [],
    }
  }

  let roleRow: {
    id: string
    slug: string
    base_archetype: string
    all_institutions: boolean
  } | null = null

  if (roleId) {
    const { data } = await supabase
      .from('roles')
      .select('id, slug, base_archetype, all_institutions')
      .eq('id', roleId)
      .maybeSingle()
    roleRow = data as any
  }

  if (!roleRow) {
    const { data } = await supabase
      .from('roles')
      .select('id, slug, base_archetype, all_institutions')
      .eq('slug', userRole)
      .eq('is_system', true)
      .maybeSingle()
    roleRow = data as any
  }

  if (!roleRow) {
    // Pre-migration fallback: coarse role helpers
    return coarseFallback(userId, userRole)
  }

  const { data: grants } = await supabase
    .from('role_capabilities')
    .select('capability_id')
    .eq('role_id', roleRow.id)

  const capIds = (grants ?? []).map((g: any) => g.capability_id).filter(Boolean)
  const keys = new Set<string>()
  if (capIds.length) {
    const { data: caps } = await supabase
      .from('capabilities')
      .select('key')
      .in('id', capIds)
    for (const row of caps ?? []) {
      if ((row as any)?.key) keys.add((row as any).key)
    }
  }

  let institutionIds: string[] = []
  const allInstitutions = Boolean(roleRow.all_institutions)
  if (!allInstitutions) {
    const { data: instRows } = await supabase
      .from('role_institutions')
      .select('institution_id')
      .eq('role_id', roleRow.id)
    institutionIds = (instRows ?? [])
      .map((r: any) => r.institution_id as string)
      .filter(Boolean)
  }

  return {
    userId,
    userRole,
    roleId: roleRow.id,
    roleSlug: roleRow.slug,
    baseArchetype: roleRow.base_archetype as UserRole,
    capabilityKeys: keys,
    allInstitutions,
    institutionIds,
  }
}

function coarseFallback(userId: string, userRole: UserRole): ResolvedCapabilities {
  const keys = new Set<string>()
  if (userRole === 'admin') {
    ;[
      CAP.DASHBOARD_VIEW,
      CAP.USERS_VIEW,
      CAP.USERS_ADD,
      CAP.USERS_EDIT,
      CAP.USERS_DELETE,
      CAP.APPROVALS_VIEW,
      CAP.APPROVALS_EDIT,
      CAP.REPORTS_VIEW,
      CAP.INSTITUTIONS_VIEW,
      CAP.INSTITUTIONS_ADD,
      CAP.INSTITUTIONS_EDIT,
      CAP.INSTITUTIONS_DELETE,
      CAP.SETTINGS_VIEW,
      CAP.SETTINGS_EDIT,
    ].forEach((k) => keys.add(k))
  } else if (userRole === 'resource_person') {
    keys.add(CAP.APPROVALS_VIEW)
    keys.add(CAP.APPROVALS_EDIT)
  }

  return {
    userId,
    userRole,
    roleId: null,
    roleSlug: userRole,
    baseArchetype: userRole,
    capabilityKeys: keys,
    allInstitutions: true,
    institutionIds: [],
  }
}

export function hasCapability(
  resolved: ResolvedCapabilities,
  key: CapabilityKey
): boolean {
  if (resolved.capabilityKeys.has('*')) return true
  if (resolved.userRole === SUPERADMIN_ROLE) return true
  return resolved.capabilityKeys.has(key)
}

export function hasAnyCapability(
  resolved: ResolvedCapabilities,
  keys: CapabilityKey[]
): boolean {
  return keys.some((k) => hasCapability(resolved, k))
}

/**
 * Server-side capability check for API routes.
 * Still authenticates via checkRBAC so we get userId/role.
 */
async function authenticateAny(request: NextRequest): Promise<RBACCheck> {
  // Lazy import to avoid circular dependency with lib/rbac.ts
  const { checkRBAC } = await import('@/lib/rbac')
  return checkRBAC(request, [
    'student',
    'instructor',
    'admin',
    'resource_person',
    'superadmin',
  ])
}

export async function checkCapability(
  request: NextRequest,
  capabilityKey: CapabilityKey | CapabilityKey[]
): Promise<CapabilityCheck> {
  const rbac = await authenticateAny(request)

  if (!rbac.hasAccess || !rbac.userId) {
    return {
      hasAccess: false,
      error: rbac.error || 'Unauthorized',
      userRole: rbac.userRole,
      userId: rbac.userId,
    }
  }

  const resolved = await resolveUserCapabilities(rbac.userId, rbac.userRole)
  const keys = Array.isArray(capabilityKey) ? capabilityKey : [capabilityKey]
  const ok = keys.some((k) => hasCapability(resolved, k))

  if (!ok) {
    return {
      hasAccess: false,
      error: 'Access denied — missing capability',
      userRole: rbac.userRole,
      userId: rbac.userId,
      capabilities: resolved,
    }
  }

  return {
    hasAccess: true,
    userRole: rbac.userRole,
    userId: rbac.userId,
    capabilities: resolved,
  }
}

export function capabilityDenied(check: CapabilityCheck) {
  return NextResponse.json(
    { error: check.error || 'Access denied' },
    { status: check.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

/** Filter a list of rows by institution_id when the role is scoped. */
export function filterByInstitutionScope<T extends { institution_id?: string | null }>(
  rows: T[],
  resolved: ResolvedCapabilities | undefined
): T[] {
  if (!resolved || resolved.allInstitutions) return rows
  const allowed = new Set(resolved.institutionIds)
  return rows.filter((r) => r.institution_id && allowed.has(r.institution_id))
}

export function institutionAllowed(
  institutionId: string | null | undefined,
  resolved: ResolvedCapabilities | undefined
): boolean {
  if (!resolved || resolved.allInstitutions) return true
  if (!institutionId) return false
  return resolved.institutionIds.includes(institutionId)
}

export type RoleRow = {
  id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
  base_archetype: UserRole
  is_assignable: boolean
  all_institutions: boolean
  sort_order: number
}

export type CapabilityRow = {
  id: string
  key: string
  label: string
  description: string | null
  cap_group: CapabilityGroup
  menu_key: string
  parent_menu_key: string | null
  action: CapabilityAction
  sort_order: number
}

export async function listRoles(db?: AdminDb) {
  const supabase = db || (await getDb())
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as RoleRow[]
}

export async function listCapabilities(db?: AdminDb) {
  const supabase = db || (await getDb())
  const { data, error } = await supabase
    .from('capabilities')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as CapabilityRow[]
}

export function slugifyRoleName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `role-${Date.now()}`
}
