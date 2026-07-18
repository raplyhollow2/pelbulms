// @ts-nocheck - Supabase type inference issues preventing build
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  Shield,
  Camera,
  ClipboardCheck,
  ShieldCheck,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { success as hapticSuccess, warning as hapticWarning } from '@/lib/utils'
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

function roleBadgeColor(role: string) {
  switch (role) {
    case 'superadmin':
      return 'bg-purple-600'
    case 'admin':
      return 'bg-red-600'
    case 'resource_person':
      return 'bg-amber-600'
    case 'instructor':
      return 'bg-blue-600'
    case 'student':
      return 'bg-green-600'
    default:
      return 'bg-gray-600'
  }
}

function roleLabel(role: string) {
  switch (role) {
    case 'superadmin':
      return 'Super Admin'
    case 'admin':
      return 'Administrator'
    case 'resource_person':
      return 'Resource Person'
    case 'instructor':
      return 'Instructor'
    case 'student':
      return 'Student'
    default:
      return role
  }
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
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-bhutan-yellow" />
        <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (!canAccessPage) return null

  const tabCols = isSuperAdmin ? 3 : canManageUsers && canApproveRegs ? 2 : 1
  const instructorCount = users.filter((u) => u.role === 'instructor').length
  const studentCount = users.filter((u) => u.role === 'student').length

  return (
    <div className="container mx-auto max-w-6xl space-y-5 px-4 py-5 sm:py-7 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-8">
      {/* Compact header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Administration
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-bhutan-orange" />
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Users</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Accounts, KYC approvals, and reviewer assignments
          </p>
        </div>
        {canManageUsers && activeTab === 'users' && (
          <Button
            size="sm"
            className="h-9 w-full shrink-0 gap-1.5 sm:w-auto"
            onClick={() => {
              setFormData({ ...EMPTY_FORM })
              setError('')
              setShowCreateForm((v) => !v)
            }}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add user
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setTab} className="w-full">
        <TabsList
          className={`grid h-9 w-full max-w-md ${
            tabCols === 3 ? 'grid-cols-3' : tabCols === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {canManageUsers && (
            <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm">
              <UsersIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">All users</span>
              <span className="sm:hidden">Users</span>
            </TabsTrigger>
          )}
          {canApproveRegs && (
            <TabsTrigger value="approvals" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Approvals</span>
              <span className="sm:hidden">Approve</span>
              {pendingCount > 0 && (
                <Badge className="ml-0.5 h-4 min-w-4 justify-center rounded-full bg-bhutan-orange px-1 text-[10px] text-white">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="reviewers" className="gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reviewers</span>
              <span className="sm:hidden">Assign</span>
            </TabsTrigger>
          )}
        </TabsList>

        {canApproveRegs && (
          <TabsContent value="approvals" className="mt-5 space-y-4">
            <PendingApprovalsPanel onCountChange={setPendingCount} />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="reviewers" className="mt-5 space-y-4">
            <ReviewersPanel />
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="users" className="mt-5 space-y-4">
        {/* Dense stats strip */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Total', value: users.length, color: 'text-bhutan-orange' },
            { label: 'Instructors', value: instructorCount, color: 'text-blue-600' },
            { label: 'Students', value: studentCount, color: 'text-green-600' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/50 bg-card/70 px-3 py-2.5"
            >
              <p className={`text-lg font-semibold tabular-nums tracking-tight sm:text-xl ${s.color}`}>
                {s.value}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Create User Form */}
        {showCreateForm && (
          <Card className="border-border/60">
            <CardHeader className="space-y-1 px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Create user</CardTitle>
              <CardDescription className="text-xs">Add a new account to the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 sm:px-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@pelsung.bt"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="full_name" className="text-xs">Full name *</Label>
                  <Input
                    id="full_name"
                    placeholder="Tashi Wangyel"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="instructor">Instructor (Teacher)</SelectItem>
                    <SelectItem value="resource_person">Resource Person</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    {isSuperAdmin && (
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-xs">Bio (optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Brief description…"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="resize-none text-sm"
                  rows={2}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button size="sm" className="h-9 w-full sm:w-auto" onClick={handleCreateUser} disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Create
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full sm:w-auto"
                  onClick={() => {
                    setShowCreateForm(false)
                    setFormData({ ...EMPTY_FORM })
                    setError('')
                  }}
                  disabled={formLoading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users List — dense rows */}
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/70">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5 sm:px-4">
            <h2 className="text-sm font-semibold tracking-tight">Directory</h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            </span>
          </div>
          <div className="divide-y divide-border/40">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || 'User'} />
                      <AvatarFallback className="bg-bhutan-yellow/15 text-[10px] font-semibold text-bhutan-orange">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium leading-tight">
                          {user.full_name || 'No name'}
                        </p>
                        <Badge className={`h-5 px-1.5 text-[10px] ${roleBadgeColor(user.role)}`}>
                          {roleLabel(user.role)}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {(user as any).email || user.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:w-auto">
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleUpdateRole(user.id, value as Role)}
                      disabled={user.role === 'superadmin' && !isSuperAdmin}
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="instructor">Instructor</SelectItem>
                        <SelectItem value="resource_person">Resource Person</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        {(isSuperAdmin || user.role === 'superadmin') && (
                          <SelectItem value="superadmin">Super Admin</SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0"
                      onClick={() => openEdit(user)}
                      title="Edit details"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 shrink-0 p-0 text-red-600 hover:text-red-700"
                            disabled={user.id === currentUser?.id}
                          />
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base">Delete user?</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">
                            This permanently deletes {user.full_name || 'this user'} and their account.
                            This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No users found. Try adjusting your search.
                </div>
              )}
          </div>
        </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit User — compact detail panel */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-md">
          <DialogHeader className="space-y-1 border-b border-border/50 px-4 py-3 sm:px-5">
            <DialogTitle className="text-base">User details</DialogTitle>
            <DialogDescription className="text-xs">
              Update profile, role, and photo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-4 py-4 sm:px-5">
            {/* Compact identity row */}
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-2.5">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage src={editData.avatar_url || undefined} alt={editData.full_name} />
                <AvatarFallback className="bg-bhutan-yellow/15 text-sm font-semibold text-bhutan-orange">
                  {getInitials(editData.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium leading-tight">
                  {editData.full_name || 'Unnamed'}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{editData.email}</p>
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
                  className="h-7 gap-1.5 px-2 text-xs"
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

            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit_name" className="text-xs">Full name</Label>
                <Input
                  id="edit_name"
                  className="h-9"
                  value={editData.full_name}
                  onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_email" className="text-xs">Email</Label>
                <Input id="edit_email" value={editData.email} disabled className="h-9 bg-muted text-sm" />
                <p className="text-[10px] text-muted-foreground">Email cannot be changed here</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_role" className="text-xs">Role</Label>
                <Select
                  value={editData.role}
                  onValueChange={(value: any) => setEditData({ ...editData, role: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="resource_person">Resource Person</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {(isSuperAdmin || editData.role === 'superadmin') && (
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit_bio" className="text-xs">Bio</Label>
                <Textarea
                  id="edit_bio"
                  value={editData.bio}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            {editError && <p className="text-sm text-red-600">{editError}</p>}
          </div>

          <DialogFooter className="flex-col-reverse gap-2 border-t border-border/50 px-4 py-3 sm:flex-row sm:px-5">
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
