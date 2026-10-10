'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { DataTable } from '@/components/data-table/data-table'
import { PersonHoverCard } from '@/components/people/person-hover-card'
import { RoleBadge } from '@/components/auth/role-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { resolveMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

type Role = 'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  instructor: 'Instructor',
  resource_person: 'Resource person',
  admin: 'Admin',
  superadmin: 'Super admin',
}

function initials(name?: string | null) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function statusClass(status?: string | null) {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
    case 'suspended':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

function textField(user: any, key: string) {
  const direct = user?.[key]
  if (typeof direct === 'string' && direct.trim()) return direct
  const meta = user?.metadata?.[key]
  return typeof meta === 'string' ? meta : ''
}

export function UserDirectory({
  users,
  canEdit,
  isSuperAdmin,
  currentUserId,
  institutionLabel,
  onRoleChange,
  onEdit,
  onDelete,
}: {
  users: any[]
  canEdit: boolean
  isSuperAdmin: boolean
  currentUserId?: string | null
  institutionLabel: (id?: string | null) => string
  onRoleChange: (userId: string, role: Role) => void
  onEdit: (user: any) => void
  onDelete: (userId: string) => void
}) {
  const [detail, setDetail] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  const columns: ColumnDef<any, unknown>[] = [
    {
      id: 'name',
      accessorFn: (user) => user.full_name || '',
      header: 'User',
      cell: ({ row }) => {
        const user = row.original
        const email = user.email || '—'
        const institution = user.institution_id ? institutionLabel(user.institution_id) : ''
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/60">
              <AvatarImage src={resolveMediaUrl(user.avatar_url) || undefined} alt="" />
              <AvatarFallback className="text-xs">{initials(user.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <PersonHoverCard
                name={user.full_name || 'Unnamed user'}
                email={email}
                lines={[
                  ROLE_LABELS[user.role] || user.role,
                  user.account_status || 'active',
                  institution,
                ]}
                onOpen={() => setDetail(user)}
              />
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: 'role',
      accessorFn: (user) => user.role || '',
      header: 'Role',
      cell: ({ row }) => {
        const user = row.original
        if (!canEdit) return <RoleBadge role={user.role || 'student'} size="sm" />
        const locked =
          (user.role === 'superadmin' && !isSuperAdmin) ||
          ((user.role === 'instructor' || user.role === 'resource_person') && !isSuperAdmin)
        return (
          <Select
            value={user.role}
            onValueChange={(value) => onRoleChange(user.id, value as Role)}
            disabled={locked}
          >
            <SelectTrigger className="h-8 w-[9.5rem] text-xs" aria-label={`Change role for ${user.full_name || user.email}`}>
              <SelectValue>{(value: string | null) => ROLE_LABELS[value || ''] || value || 'Role'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              {(isSuperAdmin || user.role === 'instructor') && (
                <SelectItem value="instructor">Instructor</SelectItem>
              )}
              {(isSuperAdmin || user.role === 'resource_person') && (
                <SelectItem value="resource_person">Resource person</SelectItem>
              )}
              <SelectItem value="admin">Admin</SelectItem>
              {(isSuperAdmin || user.role === 'superadmin') && (
                <SelectItem value="superadmin">Super admin</SelectItem>
              )}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: 'status',
      accessorFn: (user) => user.account_status || 'active',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={cn(
            'inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium capitalize',
            statusClass(row.original.account_status)
          )}
        >
          {row.original.account_status || 'active'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original
        const email = user.email || 'user'
        return (
          <div className="flex justify-end opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                aria-label={`Actions for ${user.full_name || email}`}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDetail(user)}>View</DropdownMenuItem>
                {canEdit ? (
                  <DropdownMenuItem onClick={() => onEdit(user)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                ) : null}
                {isSuperAdmin ? (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={user.id === currentUserId}
                    onClick={() => setDeleteTarget(user)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  const detailEmail = detail?.email || '—'
  const detailInstitution = detail?.institution_id ? institutionLabel(detail.institution_id) : ''

  return (
    <>
      <DataTable
        data={users}
        columns={columns}
        searchPlaceholder="Search by name, email, or phone…"
        emptyTitle="No users yet"
        emptyDescription="Add a user to start the directory."
        getSearchText={(user) =>
          [
            user.full_name,
            user.email,
            textField(user, 'phone_number'),
            user.location,
            user.id,
          ]
            .filter(Boolean)
            .join(' ')
        }
      />

      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{detail?.full_name || 'Unnamed user'}</SheetTitle>
            <SheetDescription>{detailEmail}</SheetDescription>
          </SheetHeader>
          {detail ? (
            <dl className="space-y-3 px-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Role</dt>
                <dd>{ROLE_LABELS[detail.role] || detail.role || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{detail.account_status || 'active'}</dd>
              </div>
              {detailInstitution ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Institution</dt>
                  <dd className="text-right">{detailInstitution}</dd>
                </div>
              ) : null}
              {textField(detail, 'phone_number') ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{textField(detail, 'phone_number')}</dd>
                </div>
              ) : null}
              {detail.location ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="text-right">{detail.location}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <SheetFooter>
            {canEdit && detail ? (
              <Button
                type="button"
                onClick={() => {
                  onEdit(detail)
                  setDetail(null)
                }}
              >
                Edit user
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove {deleteTarget?.full_name || deleteTarget?.email || 'this user'} and their account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
