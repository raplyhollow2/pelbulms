// @ts-nocheck - Supabase type inference issues preventing build
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  UserPlus,
  Loader2,
  Camera,
  ClipboardCheck,
  ShieldCheck,
  Users as UsersIcon,
  Ban,
  CircleCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { cn, success as hapticSuccess, warning as hapticWarning } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media'
import { coerceUserRole } from '@/lib/roles'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PendingApprovalsPanel } from '@/components/admin/pending-approvals-panel'
import { ReviewersPanel } from '@/components/admin/reviewers-panel'
import { UserDirectory } from '@/components/admin/user-directory'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/data-table/table-skeleton'
import { RoleBadge } from '@/components/auth/role-badge'
import { DZONGKHAGS, normalizeDzongkhag } from '@/lib/dzongkhags'
import { GENDER_OPTIONS } from '@/lib/profile-fields'

type Profile = Database['public']['Tables']['profiles']['Row']
type Role = 'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'

const EMPTY_FORM = {
  email: '',
  full_name: '',
  role: 'student' as Role,
  role_id: '',
  bio: '',
  headline: '',
  website: '',
  avatar_url: '',
  institution_id: '',
  account_status: 'active',
  phone_number: '',
  date_of_birth: '',
  gender: '',
  location: '',
  gewog: '',
  village: '',
  cid_number: '',
  education_level: '',
  passport_photo_url: '',
  cid_photo_url: '',
  pelsung_number: '',
  class_name: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  parent_guardian_name: '',
  parent_guardian_phone: '',
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  instructor: 'Instructor',
  resource_person: 'Resource person',
  admin: 'Admin',
  superadmin: 'Super admin',
}

function fieldText(user: any, key: string, metaKey?: string) {
  const direct = user?.[key]
  if (typeof direct === 'string' && direct.trim()) return direct
  const meta = user?.metadata?.[metaKey || key]
  return typeof meta === 'string' ? meta : ''
}

function roleTriggerLabel(
  value: string | null | undefined,
  assignableRoles: AssignableRole[],
  fallbackRole?: string
) {
  if (!value && !fallbackRole) return 'Select role'
  const found = assignableRoles.find(
    (r) => r.id === value || r.slug === value || r.base_archetype === value
  )
  if (found) return found.is_system ? found.name : `${found.name} (${found.base_archetype})`
  return ROLE_LABELS[value || ''] || ROLE_LABELS[fallbackRole || ''] || 'Select role'
}

function documentSrc(path?: string | null) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `/api/register/document?path=${encodeURIComponent(path)}`
}

type AssignableRole = {
  id: string
  slug: string
  name: string
  base_archetype: Role
  is_system: boolean
}

function getInitials(name?: string | null) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function OrganizationChecklist({
  institutions,
  selected,
  onChange,
}: {
  institutions: { id: string; name: string; display_name?: string | null }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-xs font-medium">Organizations</p>
      <p className="text-xs text-muted-foreground">
        Choose the organizations this admin may manage. Leave every box clear for a platform-wide admin.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {institutions.map((inst) => (
          <label key={inst.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(inst.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...selected, inst.id]
                    : selected.filter((id) => id !== inst.id)
                )
              }
            />
            {inst.display_name || inst.name}
          </label>
        ))}
        {institutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations yet.</p>
        ) : null}
      </div>
    </div>
  )
}

function roleSelectOptions(
  assignableRoles: AssignableRole[],
  isSuperAdmin: boolean,
  currentValue?: string
) {
  if (assignableRoles.length > 0) {
    return assignableRoles
      .filter((r) => {
        if (r.base_archetype === 'superadmin' && !isSuperAdmin && r.id !== currentValue) {
          return false
        }
        if (
          (r.base_archetype === 'instructor' || r.base_archetype === 'resource_person') &&
          !isSuperAdmin &&
          r.id !== currentValue
        ) {
          return false
        }
        return true
      })
      .map((r) => (
        <SelectItem key={r.id} value={r.id}>
          {r.name}
          {!r.is_system ? ` (${r.base_archetype})` : ''}
        </SelectItem>
      ))
  }
  return (
    <>
      <SelectItem value="student">Student</SelectItem>
      {isSuperAdmin && (
        <>
          <SelectItem value="instructor">Instructor</SelectItem>
          <SelectItem value="resource_person">Resource person</SelectItem>
        </>
      )}
      <SelectItem value="admin">Admin</SelectItem>
      {(isSuperAdmin || currentValue === 'superadmin') && (
        <SelectItem value="superadmin">Super admin</SelectItem>
      )}
    </>
  )
}

function statusBadgeClass(status?: string | null) {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
    case 'suspended':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
    case 'rejected':
      return 'border-border bg-muted text-muted-foreground'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [canAddUsers, setCanAddUsers] = useState(false)
  const [canEditUsers, setCanEditUsers] = useState(false)
  const [canApproveRegs, setCanApproveRegs] = useState(false)
  const [currentRole, setCurrentRole] = useState<Role>('admin')
  const isSuperAdmin = currentRole === 'superadmin'
  const canAccessPage = canManageUsers || canApproveRegs

  const [activeTab, setActiveTab] = useState('users')
  const [pendingCount, setPendingCount] = useState(0)

  const [users, setUsers] = useState<Profile[]>([])
  const [institutions, setInstitutions] = useState<{ id: string; name: string; display_name?: string | null }[]>([])
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([])

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [createManagedInstitutionIds, setCreateManagedInstitutionIds] = useState<string[]>([])
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')

  // Edit dialog
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editData, setEditData] = useState({ ...EMPTY_FORM })
  const [managedInstitutionIds, setManagedInstitutionIds] = useState<string[]>([])
  const [managedOrgsReady, setManagedOrgsReady] = useState(true)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingKyc, setUploadingKyc] = useState<'passport' | 'cid' | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const setTab = (tab: string) => {
    setActiveTab(tab)
    const url = tab === 'users' ? '/admin/users' : `/admin/users?tab=${tab}`
    router.replace(url, { scroll: false })
  }

  const checkAdminAccess = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/auth/login')
        return
      }
      setCurrentUser(session.user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const role = coerceUserRole(
        (profile as { role?: string } | null)?.role ||
          (session.user.app_metadata?.role as string | undefined)
      ) as Role

      let manage = role === 'admin' || role === 'superadmin'
      let addUsers = manage
      let editUsers = manage
      let approve =
        role === 'superadmin' ||
        role === 'admin' ||
        role === 'resource_person'
      let canReviewers = role === 'superadmin'

      try {
        const capRes = await fetch('/api/admin/capabilities/me')
        if (capRes.ok) {
          const capJson = await capRes.json()
          const list: string[] = capJson.capabilities || []
          const has = (key: string) => list.includes('*') || list.includes(key)
          const authoritative = capJson.catalogResolved === true || list.length > 0
          if (authoritative) {
            manage = has('admin.users.view')
            addUsers = has('admin.users.add')
            editUsers = has('admin.users.edit')
            approve = has('admin.approvals.view')
            canReviewers = has('admin.reviewers.view')
          }
        }
      } catch {
        // coarse role fallback
      }

      if (!approve && role !== 'admin' && role !== 'superadmin') {
        const { data: reviewerRows } = await supabase
          .from('registration_reviewers')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .limit(1)
        approve = !!(reviewerRows && reviewerRows.length > 0)
      }

      if (!manage && !approve && !canReviewers) {
        router.push('/dashboard')
        return
      }

      setCurrentRole(role)
      setCanManageUsers(manage)
      setCanAddUsers(addUsers)
      setCanEditUsers(editUsers)
      setCanApproveRegs(approve)

      const requested =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('tab')
          : null

      if (requested === 'reviewers' && canReviewers) {
        setActiveTab('reviewers')
      } else if (requested === 'approvals' && approve) {
        setActiveTab('approvals')
      } else if (manage) {
        setActiveTab(
          requested === 'approvals' && approve
            ? 'approvals'
            : requested === 'reviewers' && canReviewers
              ? 'reviewers'
              : 'users'
        )
      } else {
        setActiveTab('approvals')
      }

      if (manage) {
        await fetchUsers()
        try {
          const [instRes, rolesRes] = await Promise.all([
            fetch('/api/admin/institutions?archived=1'),
            fetch('/api/admin/roles/assignable'),
          ])
          if (instRes.ok) {
            const instJson = await instRes.json()
            setInstitutions(instJson.institutions || [])
          }
          if (rolesRes.ok) {
            const rolesJson = await rolesRes.json()
            setAssignableRoles(rolesJson.roles || [])
          }
        } catch {
          // institution / roles lists are optional for the directory
        }
      }

      // Prefetch pending count so the Approvals tab badge is visible immediately
      if (approve) {
        try {
          const res = await fetch('/api/admin/approvals')
          if (res.ok) {
            const data = await res.json()
            const pendingStatuses = new Set([
              'submitted',
              'under_review',
              'additional_info_requested',
            ])
            const count = (data.registrations || []).filter((r: any) =>
              pendingStatuses.has(r.registration_status)
            ).length
            setPendingCount(count)
            // Surface Approvals first when there is work waiting
            if (count > 0 && !requested) {
              setActiveTab('approvals')
            }
          }
        } catch {
          // ignore badge prefetch errors
        }
      }
    } catch (err) {
      console.error('Error checking admin access:', err)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load users')
      setUsers(json.users || [])
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message || 'Failed to load users')
    }
  }

  const handleCreateUser = async () => {
    try {
      setFormLoading(true)
      setError('')

      if (!formData.email || !formData.full_name) {
        setError('Email and full name are required')
        return
      }

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          role_id: formData.role_id || undefined,
          bio: formData.bio || null,
          institution_id: formData.institution_id || null,
          managed_institution_ids: formData.role === 'admin' ? createManagedInstitutionIds : [],
          phone_number: formData.phone_number || null,
          location: formData.location || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user')

      hapticSuccess()
      await fetchUsers()
      setFormData({ ...EMPTY_FORM })
      setCreateManagedInstitutionIds([])
      setShowCreateForm(false)
    } catch (err: any) {
      console.error('Error creating user:', err)
      setError(err.message || 'Failed to create user')
    } finally {
      setFormLoading(false)
    }
  }

  const institutionLabel = (id?: string | null) => {
    if (!id) return 'No institution'
    const i = institutions.find((x) => x.id === id)
    return i?.display_name || i?.name || 'Unknown institution'
  }

  const openEdit = (user: Profile) => {
    setEditingUser(user)
    setEditError('')
    const meta = (user as any).metadata || {}
    setEditData({
      email: (user as any).email || '',
      full_name: user.full_name || '',
      role: (user.role as Role) || 'student',
      role_id: (user as any).role_id || '',
      bio: user.bio || '',
      headline: (user as any).headline || '',
      website: (user as any).website || '',
      avatar_url: user.avatar_url || '',
      institution_id: (user as any).institution_id || '',
      account_status: (user as any).account_status || 'active',
      phone_number: fieldText(user, 'phone_number', 'phone_number'),
      date_of_birth: (user as any).date_of_birth ? String((user as any).date_of_birth).slice(0, 10) : '',
      gender: (user as any).gender || '',
      location: normalizeDzongkhag((user as any).location) || (user as any).location || '',
      gewog: (user as any).gewog || '',
      village: (user as any).village || '',
      cid_number: fieldText(user, 'cid_number', 'cid_number'),
      education_level: (user as any).education_level || '',
      passport_photo_url: (user as any).passport_photo_url || '',
      cid_photo_url: (user as any).cid_photo_url || '',
      pelsung_number: fieldText(user, 'pelsung_number', 'pelsung_number'),
      class_name: fieldText(user, 'class_name', 'class') || meta.class || '',
      emergency_contact_name: (user as any).emergency_contact_name || '',
      emergency_contact_phone: (user as any).emergency_contact_phone || '',
      parent_guardian_name: (user as any).parent_guardian_name || '',
      parent_guardian_phone: (user as any).parent_guardian_phone || '',
    })
    setManagedInstitutionIds([])
    const isAdmin = (user.role as string) === 'admin'
    setManagedOrgsReady(!isAdmin)
    if (isAdmin) {
      void fetch(`/api/users/${user.id}`)
        .then(async (res) => {
          const json = await res.json().catch(() => ({}))
          if (!res.ok) return
          setManagedInstitutionIds(json.managed_institution_ids || [])
          setManagedOrgsReady(true)
        })
        .catch(() => undefined)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    try {
      setEditLoading(true)
      setEditError('')

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editData.full_name,
          email: editData.email,
          bio: editData.bio,
          headline: editData.headline,
          website: editData.website,
          role: editData.role,
          role_id: editData.role_id || undefined,
          avatar_url: editData.avatar_url || null,
          institution_id: editData.institution_id || null,
          ...(editData.role === 'admin'
            ? managedOrgsReady
              ? { managed_institution_ids: managedInstitutionIds }
              : {}
            : { managed_institution_ids: [] }),
          account_status: editData.account_status,
          phone_number: editData.phone_number,
          date_of_birth: editData.date_of_birth,
          gender: editData.gender,
          location: editData.location,
          gewog: editData.gewog,
          village: editData.village,
          cid_number: editData.cid_number,
          education_level: editData.education_level,
          passport_photo_url: editData.passport_photo_url,
          cid_photo_url: editData.cid_photo_url,
          pelsung_number: editData.pelsung_number,
          class_name: editData.class_name,
          emergency_contact_name: editData.emergency_contact_name,
          emergency_contact_phone: editData.emergency_contact_phone,
          parent_guardian_name: editData.parent_guardian_name,
          parent_guardian_phone: editData.parent_guardian_phone,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update user')

      hapticSuccess()
      await fetchUsers()
      setEditingUser(null)
    } catch (err: any) {
      console.error('Error updating user:', err)
      setEditError(err.message || 'Failed to update user')
    } finally {
      setEditLoading(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update role')
      hapticSuccess()
      await fetchUsers()
    } catch (err: any) {
      console.error('Error updating user role:', err)
      setError(err.message || 'Failed to update user role')
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!editingUser) return
    try {
      setUploadingAvatar(true)
      setEditError('')

      const body = new FormData()
      body.append('file', file)
      body.append('userId', editingUser.id)

      const res = await fetch('/api/users/avatar', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to upload avatar')

      setEditData((prev) => ({ ...prev, avatar_url: json.avatar_url }))
      hapticSuccess()
      await fetchUsers()
    } catch (err: any) {
      console.error('Error uploading avatar:', err)
      setEditError(err.message || 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleKycUpload = async (field: 'passport' | 'cid', file: File) => {
    if (!editingUser) return
    try {
      setUploadingKyc(field)
      setEditError('')
      const body = new FormData()
      body.append('file', file)
      body.append('field', field)
      const res = await fetch(`/api/users/${editingUser.id}/kyc`, { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to upload photo')
      const key = field === 'cid' ? 'cid_photo_url' : 'passport_photo_url'
      setEditData((prev) => ({ ...prev, [key]: json.path }))
      hapticSuccess()
      await fetchUsers()
    } catch (err: any) {
      setEditError(err.message || 'Failed to upload photo')
    } finally {
      setUploadingKyc(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete user')
      hapticWarning()
      await fetchUsers()
    } catch (err: any) {
      console.error('Error deleting user:', err)
      setError(err.message || 'Failed to delete user')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <TableSkeleton />
      </div>
    )
  }

  if (!canAccessPage) return null

  const tabCols = isSuperAdmin ? 3 : canManageUsers && canApproveRegs ? 2 : 1
  const instructorCount = users.filter((u) => u.role === 'instructor').length
  const studentCount = users.filter((u) => u.role === 'student').length
  const staffCount = users.filter((u) =>
    ['admin', 'superadmin', 'resource_person'].includes(u.role || '')
  ).length

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 md:pb-10">
      {/* Page header */}
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Manage accounts, review registrations, and assign institute reviewers."
        actions={
          canManageUsers && canAddUsers && activeTab === 'users' ? (
            <Button
              size="sm"
              className="h-9 w-full shrink-0 gap-2 sm:w-auto"
              onClick={() => {
                setFormData({ ...EMPTY_FORM })
                setError('')
                setShowCreateForm(true)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Add user
            </Button>
          ) : null
        }
      />

      <Tabs value={activeTab} onValueChange={setTab} className="w-full space-y-5">
        <TabsList
          className={cn(
            'grid h-10 w-full rounded-lg bg-muted/60 p-1',
            tabCols === 3 ? 'max-w-lg grid-cols-3' : tabCols === 2 ? 'max-w-sm grid-cols-2' : 'max-w-[10rem] grid-cols-1'
          )}
        >
          {canManageUsers && (
            <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm">
              <UsersIcon className="h-3.5 w-3.5 shrink-0" />
              Directory
            </TabsTrigger>
          )}
          {canApproveRegs && (
            <TabsTrigger value="approvals" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
              Approvals
              {pendingCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="reviewers" className="gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Reviewers
            </TabsTrigger>
          )}
        </TabsList>

        {canApproveRegs && (
          <TabsContent value="approvals" className="mt-0 focus-visible:outline-none">
            <PendingApprovalsPanel onCountChange={setPendingCount} />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="reviewers" className="mt-0 focus-visible:outline-none">
            <ReviewersPanel />
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="users" className="mt-0 space-y-4 focus-visible:outline-none">
            {/* Summary metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total users', value: users.length },
                { label: 'Students', value: studentCount },
                { label: 'Instructors', value: instructorCount },
                { label: 'Staff', value: staffCount },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border/60 bg-card px-3.5 py-3"
                >
                  <p className="text-xl font-semibold tabular-nums tracking-tight">{s.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <Dialog open={showCreateForm} onOpenChange={(open) => {
              setShowCreateForm(open)
              if (!open) {
                setFormData({ ...EMPTY_FORM })
                setError('')
              }
            }}>
              <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create user</DialogTitle>
                  <DialogDescription>
                    Invite a new account. They can sign in once created.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@institution.bt"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name" className="text-xs font-medium">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="full_name"
                      autoComplete="name"
                      placeholder="Full legal name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-xs font-medium">
                      Role <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={
                        assignableRoles.length
                          ? formData.role_id ||
                            assignableRoles.find((r) => r.slug === formData.role)?.id ||
                            ''
                          : formData.role
                      }
                      onValueChange={(value: string) => {
                        if (assignableRoles.length) {
                          const found = assignableRoles.find((r) => r.id === value)
                          setFormData({
                            ...formData,
                            role_id: value,
                            role: (found?.base_archetype || 'student') as Role,
                          })
                        } else {
                          setFormData({ ...formData, role: value as Role, role_id: '' })
                        }
                      }}
                    >
                      <SelectTrigger id="role" className="h-10 w-full">
                        <SelectValue>
                          {(v: string | null) => roleTriggerLabel(v, assignableRoles, formData.role)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {roleSelectOptions(assignableRoles, isSuperAdmin)}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.role === 'admin' ? (
                    <OrganizationChecklist
                      institutions={institutions}
                      selected={createManagedInstitutionIds}
                      onChange={setCreateManagedInstitutionIds}
                    />
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone_number" className="text-xs font-medium">
                      Mobile number
                    </Label>
                    <Input
                      id="phone_number"
                      inputMode="tel"
                      placeholder="+97517123456"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create_dzongkhag" className="text-xs font-medium">
                      Dzongkhag
                    </Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value ?? '' })}
                    >
                      <SelectTrigger id="create_dzongkhag" className="h-10 w-full">
                        <SelectValue placeholder="Select dzongkhag">
                          {(v: string | null) => v || 'Select dzongkhag'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {DZONGKHAGS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="bio" className="text-xs font-medium">
                      Bio <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="bio"
                      placeholder="Short description…"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      className="min-h-[4.5rem] resize-none"
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter className="mt-2 sm:justify-end">
                  <Button size="sm" className="h-9 gap-1.5" onClick={handleCreateUser} disabled={formLoading}>
                    {formLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    {formLoading ? 'Creating…' : 'Create user'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <UserDirectory
              users={users}
              canEdit={canEditUsers}
              isSuperAdmin={isSuperAdmin}
              currentUserId={currentUser?.id}
              institutionLabel={institutionLabel}
              onRoleChange={(userId, role) => handleUpdateRole(userId, role)}
              onEdit={openEdit}
              onDelete={handleDeleteUser}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit user dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[92dvh] max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="space-y-1 border-b border-border/50 px-5 py-4">
            <DialogTitle className="text-base">Edit user</DialogTitle>
            <DialogDescription className="text-xs">
              {isSuperAdmin
                ? 'Update every profile field, including the sign-in email.'
                : 'Update every profile field.'}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(70dvh,36rem)] space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <Avatar className="h-12 w-12 shrink-0 ring-1 ring-border/60">
                <AvatarImage
                  src={resolveMediaUrl(editData.avatar_url) || undefined}
                  alt={editData.full_name}
                />
                <AvatarFallback className="bg-muted text-sm font-semibold text-muted-foreground">
                  {getInitials(editData.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate text-sm font-medium">{editData.full_name || 'Unnamed'}</p>
                <p className="truncate text-xs text-muted-foreground">{editData.email}</p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleAvatarUpload(file)
                    e.target.value = ''
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3" />
                  )}
                  {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                </Button>
              </div>
            </div>

            <div className="grid gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="edit_name" className="text-xs font-medium">
                  Full name
                </Label>
                <Input
                  id="edit_name"
                  className="h-10"
                  value={editData.full_name}
                  onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_email" className="text-xs font-medium">
                  Email
                </Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editData.email}
                  disabled={!isSuperAdmin}
                  className={cn('h-10', !isSuperAdmin && 'bg-muted/50')}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  {isSuperAdmin
                    ? 'Changing email updates the sign-in address.'
                    : 'Only a superadmin can change email.'}
                </p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit_phone" className="text-xs font-medium">
                    Mobile number
                  </Label>
                  <Input
                    id="edit_phone"
                    inputMode="tel"
                    className="h-10"
                    placeholder="+97517123456"
                    value={editData.phone_number}
                    onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_dob" className="text-xs font-medium">
                    Date of birth
                  </Label>
                  <Input
                    id="edit_dob"
                    type="date"
                    className="h-10"
                    value={editData.date_of_birth}
                    onChange={(e) => setEditData({ ...editData, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_gender" className="text-xs font-medium">
                    Gender
                  </Label>
                  <Select
                    value={editData.gender || '__none__'}
                    onValueChange={(value) =>
                      setEditData({ ...editData, gender: !value || value === '__none__' ? '' : value })
                    }
                  >
                    <SelectTrigger id="edit_gender" className="h-10 w-full">
                      <SelectValue>
                        {(v: string | null) =>
                          GENDER_OPTIONS.find((g) => g.value === v)?.label || 'Not set'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_dzongkhag" className="text-xs font-medium">
                    Dzongkhag
                  </Label>
                  <Select
                    value={editData.location || '__none__'}
                    onValueChange={(value) =>
                      setEditData({
                        ...editData,
                        location: !value || value === '__none__' ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger id="edit_dzongkhag" className="h-10 w-full">
                      <SelectValue>
                        {(v: string | null) => (!v || v === '__none__' ? 'Not set' : v)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {DZONGKHAGS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_gewog" className="text-xs font-medium">
                    Gewog
                  </Label>
                  <Input
                    id="edit_gewog"
                    className="h-10"
                    value={editData.gewog}
                    onChange={(e) => setEditData({ ...editData, gewog: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_village" className="text-xs font-medium">
                    Village
                  </Label>
                  <Input
                    id="edit_village"
                    className="h-10"
                    value={editData.village}
                    onChange={(e) => setEditData({ ...editData, village: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_cid" className="text-xs font-medium">
                    CID number
                  </Label>
                  <Input
                    id="edit_cid"
                    inputMode="numeric"
                    maxLength={11}
                    className="h-10"
                    value={editData.cid_number}
                    onChange={(e) =>
                      setEditData({ ...editData, cid_number: e.target.value.replace(/\D/g, '') })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_staff_id" className="text-xs font-medium">
                    Student / staff ID
                  </Label>
                  <Input
                    id="edit_staff_id"
                    className="h-10"
                    value={editData.pelsung_number}
                    onChange={(e) => setEditData({ ...editData, pelsung_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_class" className="text-xs font-medium">
                    Class
                  </Label>
                  <Input
                    id="edit_class"
                    className="h-10"
                    value={editData.class_name}
                    onChange={(e) => setEditData({ ...editData, class_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_education" className="text-xs font-medium">
                    Education level
                  </Label>
                  <Input
                    id="edit_education"
                    className="h-10"
                    value={editData.education_level}
                    onChange={(e) => setEditData({ ...editData, education_level: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_emergency_name" className="text-xs font-medium">
                    Emergency contact
                  </Label>
                  <Input
                    id="edit_emergency_name"
                    className="h-10"
                    value={editData.emergency_contact_name}
                    onChange={(e) =>
                      setEditData({ ...editData, emergency_contact_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_emergency_phone" className="text-xs font-medium">
                    Emergency phone
                  </Label>
                  <Input
                    id="edit_emergency_phone"
                    className="h-10"
                    value={editData.emergency_contact_phone}
                    onChange={(e) =>
                      setEditData({ ...editData, emergency_contact_phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_guardian" className="text-xs font-medium">
                    Parent / guardian
                  </Label>
                  <Input
                    id="edit_guardian"
                    className="h-10"
                    value={editData.parent_guardian_name}
                    onChange={(e) =>
                      setEditData({ ...editData, parent_guardian_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_guardian_phone" className="text-xs font-medium">
                    Guardian phone
                  </Label>
                  <Input
                    id="edit_guardian_phone"
                    className="h-10"
                    value={editData.parent_guardian_phone}
                    onChange={(e) =>
                      setEditData({ ...editData, parent_guardian_phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['passport', 'Identity photo', editData.passport_photo_url],
                  ['cid', 'CID photo', editData.cid_photo_url],
                ] as const).map(([field, label, path]) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs font-medium">{label}</Label>
                    {path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={documentSrc(path)}
                        alt={label}
                        className="h-28 w-full rounded-lg border border-border/60 object-cover"
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                        No photo
                      </div>
                    )}
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleKycUpload(field, file)
                          e.target.value = ''
                        }}
                      />
                      <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input px-2.5 text-xs">
                        {uploadingKyc === field ? 'Uploading…' : path ? 'Replace photo' : 'Upload photo'}
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_role" className="text-xs font-medium">
                  Role
                </Label>
                <Select
                  value={
                    assignableRoles.length
                      ? editData.role_id ||
                        assignableRoles.find((r) => r.slug === editData.role)?.id ||
                        ''
                      : editData.role
                  }
                  onValueChange={(value: string) => {
                    if (assignableRoles.length) {
                      const found = assignableRoles.find((r) => r.id === value)
                      setEditData({
                        ...editData,
                        role_id: value,
                        role: (found?.base_archetype || 'student') as Role,
                      })
                    } else {
                      setEditData({ ...editData, role: value as Role, role_id: '' })
                    }
                  }}
                >
                  <SelectTrigger id="edit_role" className="h-10 w-full">
                    <SelectValue>
                      {(v: string | null) => roleTriggerLabel(v, assignableRoles, editData.role)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roleSelectOptions(
                      assignableRoles,
                      isSuperAdmin,
                      editData.role_id || editData.role
                    )}
                  </SelectContent>
                </Select>
              </div>
              {editData.role === 'admin' ? (
                <OrganizationChecklist
                  institutions={institutions}
                  selected={managedInstitutionIds}
                  onChange={setManagedInstitutionIds}
                />
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="edit_institution" className="text-xs font-medium">
                  Institution
                </Label>
                <Select
                  value={editData.institution_id || '__none__'}
                  onValueChange={(value: any) =>
                    setEditData({ ...editData, institution_id: value === '__none__' ? '' : value })
                  }
                >
                  <SelectTrigger id="edit_institution" className="h-10 w-full">
                    <SelectValue>
                      {(v: string | null) =>
                        !v || v === '__none__' ? 'No institution' : institutionLabel(v)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No institution</SelectItem>
                    {institutions.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.display_name || i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_status" className="text-xs font-medium">
                  Account status
                </Label>
                <Select
                  value={editData.account_status || 'active'}
                  onValueChange={(value: any) => setEditData({ ...editData, account_status: value })}
                >
                  <SelectTrigger id="edit_status" className="h-10 w-full">
                    <SelectValue>
                      {(v: string | null) =>
                        v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Active'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2 pt-1">
                  {editData.account_status === 'suspended' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setEditData({ ...editData, account_status: 'active' })}
                    >
                      <CircleCheck className="h-3 w-3" /> Activate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-destructive"
                      disabled={editingUser?.id === currentUser?.id}
                      onClick={() => setEditData({ ...editData, account_status: 'suspended' })}
                    >
                      <Ban className="h-3 w-3" /> Suspend
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_headline" className="text-xs font-medium">
                  Headline
                </Label>
                <Input
                  id="edit_headline"
                  className="h-10"
                  value={editData.headline}
                  onChange={(e) => setEditData({ ...editData, headline: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_website" className="text-xs font-medium">
                  Website
                </Label>
                <Input
                  id="edit_website"
                  className="h-10"
                  value={editData.website}
                  onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_bio" className="text-xs font-medium">
                  Bio
                </Label>
                <Textarea
                  id="edit_bio"
                  value={editData.bio}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>

          <DialogFooter className="flex-col-reverse gap-2 border-t border-border/50 px-5 py-3.5 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setEditingUser(null)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button size="sm" className="h-9" onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
