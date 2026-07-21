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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Camera,
  ClipboardCheck,
  ShieldCheck,
  Users as UsersIcon,
  MoreHorizontal,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { cn, success as hapticSuccess, warning as hapticWarning } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PendingApprovalsPanel } from '@/components/admin/pending-approvals-panel'
import { ReviewersPanel } from '@/components/admin/reviewers-panel'

type Profile = Database['public']['Tables']['profiles']['Row']
type Role = 'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'

const EMPTY_FORM = {
  email: '',
  full_name: '',
  role: 'student' as Role,
  bio: '',
  avatar_url: '',
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

function roleBadgeClass(role: string) {
  switch (role) {
    case 'superadmin':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
    case 'admin':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
    case 'resource_person':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
    case 'instructor':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    case 'student':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

function roleLabel(role: string) {
  switch (role) {
    case 'superadmin':
      return 'Super admin'
    case 'admin':
      return 'Admin'
    case 'resource_person':
      return 'Resource person'
    case 'instructor':
      return 'Instructor'
    case 'student':
      return 'Student'
    default:
      return role
  }
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium capitalize tracking-wide',
        roleBadgeClass(role)
      )}
    >
      {roleLabel(role)}
    </span>
  )
}

export default function AdminUsersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [canApproveRegs, setCanApproveRegs] = useState(false)
  const [currentRole, setCurrentRole] = useState<Role>('admin')
  const isSuperAdmin = currentRole === 'superadmin'
  const canAccessPage = canManageUsers || canApproveRegs

  const [activeTab, setActiveTab] = useState('users')
  const [pendingCount, setPendingCount] = useState(0)

  const [users, setUsers] = useState<Profile[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')

  // Edit dialog
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editData, setEditData] = useState({ ...EMPTY_FORM })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
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

      const metaRole =
        session.user.app_metadata?.role || session.user.user_metadata?.role || null
      const profileRole = (profile as { role?: string } | null)?.role || null
      const role = (
        profileRole === 'superadmin' || metaRole === 'superadmin'
          ? 'superadmin'
          : profileRole === 'resource_person' || metaRole === 'resource_person'
            ? 'resource_person'
            : profileRole || metaRole || 'student'
      ) as Role

      const manage = role === 'admin' || role === 'superadmin'
      // Admins and superadmins always manage the approval queue; RPs and assigned reviewers too.
      let approve =
        role === 'superadmin' ||
        role === 'admin' ||
        role === 'resource_person'

      if (!approve) {
        const { data: reviewerRows } = await supabase
          .from('registration_reviewers')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .limit(1)
        approve = !!(reviewerRows && reviewerRows.length > 0)
      }

      if (!manage && !approve) {
        router.push('/dashboard')
        return
      }

      setCurrentRole(role)
      setCanManageUsers(manage)
      setCanApproveRegs(approve)

      const requested =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('tab')
          : null

      if (requested === 'reviewers' && role === 'superadmin') {
        setActiveTab('reviewers')
      } else if (requested === 'approvals' && approve) {
        setActiveTab('approvals')
      } else if (manage) {
        setActiveTab(
          requested === 'approvals' && approve
            ? 'approvals'
            : requested === 'reviewers' && role === 'superadmin'
              ? 'reviewers'
              : 'users'
        )
      } else {
        setActiveTab('approvals')
      }

      if (manage) await fetchUsers()

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

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      user.full_name?.toLowerCase().includes(q) ||
      (user as any).email?.toLowerCase().includes(q) ||
      user.id.toLowerCase().includes(q)
    )
  })

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
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user')

      hapticSuccess()
      await fetchUsers()
      setFormData({ ...EMPTY_FORM })
      setShowCreateForm(false)
    } catch (err: any) {
      console.error('Error creating user:', err)
      setError(err.message || 'Failed to create user')
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (user: Profile) => {
    setEditingUser(user)
    setEditError('')
    setEditData({
      email: (user as any).email || '',
      full_name: user.full_name || '',
      role: (user.role as Role) || 'student',
      bio: user.bio || '',
      avatar_url: user.avatar_url || '',
    })
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
          bio: editData.bio,
          role: editData.role,
          avatar_url: editData.avatar_url || null,
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
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading users…</span>
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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-10">
      {/* Page header */}
      <header className="flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Administration
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Manage accounts, review registrations, and assign institute reviewers.
          </p>
        </div>
        {canManageUsers && activeTab === 'users' && (
          <Button
            size="sm"
            className="h-9 w-full shrink-0 gap-2 sm:w-auto"
            onClick={() => {
              setFormData({ ...EMPTY_FORM })
              setError('')
              setShowCreateForm((v) => !v)
            }}
          >
            <UserPlus className="h-4 w-4" />
            {showCreateForm ? 'Close form' : 'Add user'}
          </Button>
        )}
      </header>

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
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bhutan-orange px-1 text-[10px] font-semibold text-white">
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

            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-9"
                  aria-label="Search users"
                />
              </div>
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground sm:text-right">
                {filteredUsers.length} of {users.length}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {/* Create user */}
            {showCreateForm && (
              <section className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold">Create user</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Invite a new account. They can sign in once created.
                  </p>
                </div>
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
                      value={formData.role}
                      onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger id="role" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="instructor">Instructor</SelectItem>
                        <SelectItem value="resource_person">Resource person</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        {isSuperAdmin && (
                          <SelectItem value="superadmin">Super admin</SelectItem>
                        )}
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
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setShowCreateForm(false)
                      setFormData({ ...EMPTY_FORM })
                      setError('')
                    }}
                    disabled={formLoading}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="h-9 gap-1.5" onClick={handleCreateUser} disabled={formLoading}>
                    {formLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    {formLoading ? 'Creating…' : 'Create user'}
                  </Button>
                </div>
              </section>
            )}

            {/* Directory */}
            <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
              {/* Desktop column headers */}
              <div className="hidden border-b border-border/50 bg-muted/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.6fr)_9rem_minmax(11rem,auto)] lg:gap-4 lg:px-5">
                <span>User</span>
                <span>Role</span>
                <span className="text-right">Actions</span>
              </div>

              <ul className="divide-y divide-border/50">
                {filteredUsers.map((user) => {
                  const email = (user as any).email || '—'
                  const avatar = resolveMediaUrl(user.avatar_url) || undefined
                  return (
                    <li
                      key={user.id}
                      className="px-4 py-3.5 transition-colors hover:bg-muted/25 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1.6fr)_9rem_minmax(11rem,auto)] lg:items-center lg:gap-4 lg:py-3"
                    >
                      {/* Identity */}
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/60">
                          <AvatarImage src={avatar} alt={user.full_name || 'User'} />
                          <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium leading-snug">
                              {user.full_name || 'Unnamed user'}
                            </p>
                            <span className="lg:hidden">
                              <RoleBadge role={user.role || 'student'} />
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
                        </div>
                      </div>

                      {/* Role (desktop) */}
                      <div className="hidden lg:block">
                        <RoleBadge role={user.role || 'student'} />
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex items-center gap-2 lg:mt-0 lg:justify-end">
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleUpdateRole(user.id, value as Role)}
                          disabled={user.role === 'superadmin' && !isSuperAdmin}
                        >
                          <SelectTrigger
                            className="h-9 flex-1 text-xs lg:w-[9.5rem] lg:flex-none"
                            aria-label={`Change role for ${user.full_name || email}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="instructor">Instructor</SelectItem>
                            <SelectItem value="resource_person">Resource person</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            {(isSuperAdmin || user.role === 'superadmin') && (
                              <SelectItem value="superadmin">Super admin</SelectItem>
                            )}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 shrink-0 p-0"
                          onClick={() => openEdit(user)}
                          aria-label={`Edit ${user.full_name || email}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={user.id === currentUser?.id}
                                aria-label={`Delete ${user.full_name || email}`}
                              />
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Permanently remove{' '}
                                <span className="font-medium text-foreground">
                                  {user.full_name || email}
                                </span>{' '}
                                and their account. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete user
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  )
                })}

                {filteredUsers.length === 0 && (
                  <li className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No users match your search</p>
                    <p className="text-xs text-muted-foreground">
                      Try a different name or email, or clear the search field.
                    </p>
                  </li>
                )}
              </ul>
            </section>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit user dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[92dvh] max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-1 border-b border-border/50 px-5 py-4">
            <DialogTitle className="text-base">Edit user</DialogTitle>
            <DialogDescription className="text-xs">
              Update profile details and role assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(70dvh,32rem)] space-y-4 overflow-y-auto px-5 py-4">
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
                <Input id="edit_email" value={editData.email} disabled className="h-10 bg-muted/50" />
                <p className="text-[11px] text-muted-foreground">Email cannot be changed here.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_role" className="text-xs font-medium">
                  Role
                </Label>
                <Select
                  value={editData.role}
                  onValueChange={(value: any) => setEditData({ ...editData, role: value })}
                >
                  <SelectTrigger id="edit_role" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="resource_person">Resource person</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {(isSuperAdmin || editData.role === 'superadmin') && (
                      <SelectItem value="superadmin">Super admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
