import { createSupabaseServerClient } from '@/lib/supabase/server'
import { USER_ROLES, type UserRole } from '@/lib/roles'

/** Internal headers. Middleware deletes any client-sent values before setting these. */
export const REQUEST_USER_ID = 'x-pelbu-user-id'
export const REQUEST_USER_ROLE = 'x-pelbu-user-role'
export const REQUEST_USER_EMAIL = 'x-pelbu-user-email'
export const REQUEST_USER_STATUS = 'x-pelbu-user-status'
export const REQUEST_USER_SIG = 'x-pelbu-user-sig'

const HEADER_NAMES = [
  REQUEST_USER_ID,
  REQUEST_USER_ROLE,
  REQUEST_USER_EMAIL,
  REQUEST_USER_STATUS,
  REQUEST_USER_SIG,
] as const

export type StampedRequestUser = {
  id: string
  role: UserRole | null
  email: string | null
  accountStatus: string | null
  app_metadata: Record<string, unknown>
  user_metadata: Record<string, unknown>
}

export function stripRequestUserHeaders(headers: Headers) {
  for (const name of HEADER_NAMES) headers.delete(name)
}

function stampSecret(): string | null {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_JWT_SECRET || ''
  const trimmed = secret.trim()
  return trimmed.length > 0 ? trimmed : null
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signPayload(payload: string): Promise<string | null> {
  const secret = stampSecret()
  if (!secret) return null
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return bytesToHex(sig)
}

function payloadFor(user: {
  id: string
  role: string | null
  email: string | null
  accountStatus: string | null
}): string {
  return [user.id, user.role || '', user.email || '', user.accountStatus || ''].join('\n')
}

function withMetadata(user: {
  id: string
  role: UserRole | null
  email: string | null
  accountStatus: string | null
}): StampedRequestUser {
  return {
    ...user,
    app_metadata: {
      ...(user.role ? { role: user.role } : {}),
      ...(user.accountStatus ? { account_status: user.accountStatus } : {}),
    },
    user_metadata: {},
  }
}

export function roleFromMetadata(role: unknown): UserRole | null {
  return typeof role === 'string' && (USER_ROLES as string[]).includes(role)
    ? (role as UserRole)
    : null
}

export async function applyRequestUserHeaders(
  headers: Headers,
  user: { id: string; email?: string | null; app_metadata?: Record<string, unknown> | null }
) {
  stripRequestUserHeaders(headers)
  const stamped = {
    id: user.id,
    role: roleFromMetadata(user.app_metadata?.role),
    email: user.email || null,
    accountStatus:
      typeof user.app_metadata?.account_status === 'string'
        ? user.app_metadata.account_status
        : null,
  }
  const sig = await signPayload(payloadFor(stamped))
  if (!sig) return
  headers.set(REQUEST_USER_ID, stamped.id)
  if (stamped.role) headers.set(REQUEST_USER_ROLE, stamped.role)
  if (stamped.email) headers.set(REQUEST_USER_EMAIL, stamped.email)
  if (stamped.accountStatus) headers.set(REQUEST_USER_STATUS, stamped.accountStatus)
  headers.set(REQUEST_USER_SIG, sig)
}

export async function readStampedUser(request: {
  headers: Headers
}): Promise<StampedRequestUser | null> {
  const id = request.headers.get(REQUEST_USER_ID)?.trim() || ''
  const sig = request.headers.get(REQUEST_USER_SIG)?.trim() || ''
  if (!id || !sig) return null
  const role = roleFromMetadata(request.headers.get(REQUEST_USER_ROLE))
  const email = request.headers.get(REQUEST_USER_EMAIL)?.trim() || null
  const accountStatus = request.headers.get(REQUEST_USER_STATUS)?.trim() || null
  const stamped = { id, role, email, accountStatus }
  const expected = await signPayload(payloadFor(stamped))
  if (!expected || expected !== sig) return null
  return withMetadata(stamped)
}

/**
 * User already verified by middleware on this request.
 * Falls back to getUser() only when middleware could not stamp (Auth timeout).
 * A browser-supplied header fails the signature check and is ignored.
 */
export async function getRequestUser(request: { headers: Headers }): Promise<StampedRequestUser | null> {
  const stamped = await readStampedUser(request)
  if (stamped) return stamped

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return withMetadata({
    id: user.id,
    role: roleFromMetadata(user.app_metadata?.role),
    email: user.email || null,
    accountStatus:
      typeof user.app_metadata?.account_status === 'string'
        ? user.app_metadata.account_status
        : null,
  })
}
