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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
          <span className="ml-3 text-muted-foreground">Checking permissions...</span>
        </div>
      </div>
    )
  }

  if (!canAccessPage) return null

  const tabCols = isSuperAdmin ? 3 : canManageUsers && canApproveRegs ? 2 : 1

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Shield className="h-7 w-7 shrink-0 text-bhutan-yellow sm:h-8 sm:w-8" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">Users</h1>
            <p className="text-sm text-muted-foreground">
              Manage accounts, approve new registrations, and assign reviewers.
            </p>
          </div>
        </div>
        {canManageUsers && activeTab === 'users' && (
          <Button
            className="w-full shrink-0 sm:w-auto"
            onClick={() => {
              setFormData({ ...EMPTY_FORM })
              setError('')
              setShowCreateForm((v) => !v)
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setTab} className="w-full">
        <TabsList
          className={`grid h-auto min-h-10 w-full max-w-full ${
            tabCols === 3 ? 'grid-cols-3' : tabCols === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {canManageUsers && (
            <TabsTrigger value="users" className="gap-1.5">
              <UsersIcon className="h-4 w-4" />
              <span className="hidden sm:inline">All users</span>
              <span className="sm:hidden">Users</span>
            </TabsTrigger>
          )}
          {canApproveRegs && (
            <TabsTrigger value="approvals" className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Approvals</span>
              <span className="sm:hidden">Approve</span>
              {pendingCount > 0 && (
                <Badge className="ml-0.5 h-5 min-w-5 justify-center rounded-full bg-bhutan-orange px-1.5 text-[10px] text-white">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="reviewers" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Reviewers</span>
              <span className="sm:hidden">Assign</span>
            </TabsTrigger>
          )}
        </TabsList>

        {canApproveRegs && (
          <TabsContent value="approvals" className="mt-6 space-y-4">
            <PendingApprovalsPanel onCountChange={setPendingCount} />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="reviewers" className="mt-6 space-y-4">
            <ReviewersPanel />
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="users" className="mt-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="glass">
            <CardHeader className="pb-1 px-3 pt-3 sm:pb-2 sm:px-6 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-xs font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-bhutan-yellow">{users.length}</div>
              <p className="hidden sm:block text-xs text-muted-foreground mt-1">Registered users</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-1 px-3 pt-3 sm:pb-2 sm:px-6 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-xs font-medium">Instructors</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">
                {users.filter((u) => u.role === 'instructor').length}
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground mt-1">Active teachers</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-1 px-3 pt-3 sm:pb-2 sm:px-6 sm:pt-6">
              <CardTitle className="text-[11px] sm:text-xs font-medium">Students</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {users.filter((u) => u.role === 'student').length}
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground mt-1">Active learners</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            placeholder="Search by name, email or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Create User Form */}
        {showCreateForm && (
          <Card className="glass-strong">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>Create New User</CardTitle>
              <CardDescription>Add a new user to the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@pelsung.bt"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="glass"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    placeholder="Tashi Wangyel"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="glass"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="glass">
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

              <div className="space-y-2">
                <Label htmlFor="bio">Bio (Optional)</Label>
                <Textarea
                  id="bio"
                  placeholder="Brief description..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="glass resize-none"
                  rows={3}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button className="w-full sm:w-auto" onClick={handleCreateUser} disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create User
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
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

        {/* Users List */}
        <Card className="glass-strong">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-background/50 rounded-lg hover:bg-background/70 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || 'User'} />
                      <AvatarFallback className="bg-bhutan-yellow/20 text-bhutan-yellow font-semibold">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{user.full_name || 'No name'}</p>
                        <Badge className={roleBadgeColor(user.role)}>{roleLabel(user.role)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {(user as any).email || user.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleUpdateRole(user.id, value as Role)}
                      disabled={user.role === 'superadmin' && !isSuperAdmin}
                    >
                      <SelectTrigger className="flex-1 sm:w-36">
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
                      className="shrink-0"
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 shrink-0"
                            disabled={user.id === currentUser?.id}
                          />
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes {user.full_name || 'this user'} and their account.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
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
                <div className="text-center py-8 text-muted-foreground">
                  No users found. Try adjusting your search.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update profile details and picture</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 shrink-0">
                <AvatarImage src={editData.avatar_url || undefined} alt={editData.full_name} />
                <AvatarFallback className="bg-bhutan-yellow/20 text-bhutan-yellow font-semibold text-xl">
                  {getInitials(editData.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 min-w-0">
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
                  className="gap-2"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {uploadingAvatar ? 'Uploading...' : 'Change Picture'}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or GIF, up to 5MB</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_name">Full Name</Label>
              <Input
                id="edit_name"
                value={editData.full_name}
                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input id="edit_email" value={editData.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_role">Role</Label>
              <Select
                value={editData.role}
                onValueChange={(value: any) => setEditData({ ...editData, role: value })}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="edit_bio">Bio</Label>
              <Textarea
                id="edit_bio"
                value={editData.bio}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                rows={3}
                className="resize-none"
              />
            </div>

            {editError && <p className="text-sm text-red-600">{editError}</p>}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={editLoading}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
