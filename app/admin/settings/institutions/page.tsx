'use client'

import { useEffect, useState } from 'react'
import {
  Archive,
  Building2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

type Institution = {
  id: string
  name: string
  slug: string
  display_name: string | null
  logo_url: string | null
  domain: string | null
  description: string | null
  max_students: number | null
  allowed_email_domains: string[] | null
  is_active: boolean
  archived_at: string | null
  user_count: number
}

const EMPTY = {
  name: '',
  display_name: '',
  slug: '',
  logo_url: '',
  domain: '',
  description: '',
  max_students: '',
  allowed_email_domains: '',
}

export default function AdminInstitutionsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [rows, setRows] = useState<Institution[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Institution | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [archiveTarget, setArchiveTarget] = useState<Institution | null>(null)

  const load = async (archived = showArchived) => {
    const res = await fetch(`/api/admin/institutions${archived ? '?archived=1' : ''}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load institutions')
    setRows(data.institutions || [])
  }

  useEffect(() => {
    ;(async () => {
      try {
        await load(false)
      } catch (e: any) {
        toast.error(e.message || 'Failed to load institutions')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleArchived = async (next: boolean) => {
    setShowArchived(next)
    setLoading(true)
    try {
      await load(next)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load institutions')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }

  const openEdit = (row: Institution) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      display_name: row.display_name || '',
      slug: row.slug || '',
      logo_url: row.logo_url || '',
      domain: row.domain || '',
      description: row.description || '',
      max_students: row.max_students != null ? String(row.max_students) : '',
      allowed_email_domains: (row.allowed_email_domains || []).join(', '),
    })
    setDialogOpen(true)
  }

  const payload = () => ({
    name: form.name,
    display_name: form.display_name || form.name,
    slug: form.slug || undefined,
    logo_url: form.logo_url || null,
    domain: form.domain || null,
    description: form.description || null,
    max_students: form.max_students ? Number(form.max_students) : null,
    allowed_email_domains: form.allowed_email_domains,
  })

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        editing ? `/api/admin/institutions/${editing.id}` : '/api/admin/institutions',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload()),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success(editing ? 'Institution updated' : 'Institution created')
      setDialogOpen(false)
      await load(showArchived)
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const archive = async () => {
    if (!archiveTarget) return
    try {
      const res = await fetch(`/api/admin/institutions/${archiveTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Archive failed')
      toast.success(`${archiveTarget.name} archived and hidden from sign-up`)
      setArchiveTarget(null)
      await load(showArchived)
    } catch (e: any) {
      toast.error(e.message || 'Archive failed')
    }
  }

  const restore = async (row: Institution) => {
    try {
      const res = await fetch(`/api/admin/institutions/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Restore failed')
      toast.success(`${row.name} restored`)
      await load(showArchived)
    } catch (e: any) {
      toast.error(e.message || 'Restore failed')
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading institutions…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Add government bodies such as Dessung and Pelsung. Archiving hides them from sign-up
          without deleting learner records.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={toggleArchived} />
            Show archived
          </label>
          <Button size="sm" className="h-9 gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Add institution
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="hidden border-b border-border/50 bg-muted/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[minmax(0,1.4fr)_8rem_5rem_minmax(8rem,auto)] md:gap-3">
          <span>Institution</span>
          <span>Slug</span>
          <span>Users</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="divide-y divide-border/50">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 px-4 py-3.5 md:grid md:grid-cols-[minmax(0,1.4fr)_8rem_5rem_minmax(8rem,auto)] md:items-center md:gap-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{row.display_name || row.name}</p>
                  {!row.is_active && <Badge variant="secondary">Archived</Badge>}
                </div>
                {row.display_name && row.display_name !== row.name && (
                  <p className="truncate text-xs text-muted-foreground">{row.name}</p>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground">{row.slug}</p>
              <p className="text-sm tabular-nums">{row.user_count}</p>
              <div className="flex gap-2 md:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => openEdit(row)}
                  aria-label={`Edit ${row.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {row.is_active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => setArchiveTarget(row)}
                    aria-label={`Archive ${row.name}`}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => restore(row)}
                    aria-label={`Restore ${row.name}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Building2 className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-sm font-medium">No institutions yet</p>
              <p className="text-xs text-muted-foreground">Add Dessung, Pelsung, or another body.</p>
            </li>
          )}
        </ul>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="space-y-1 border-b border-border/50 px-5 py-4">
            <DialogTitle className="text-base">
              {editing ? 'Edit institution' : 'Add institution'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Shown on the sign-up institution step and reviewer assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(70dvh,36rem)] space-y-3 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Dessung"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Short label</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Dessung"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="dessung"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Domain</Label>
                <Input
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  placeholder="dessung.gov.bt"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max learners</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_students}
                  onChange={(e) => setForm((f) => ({ ...f, max_students: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Logo URL</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Allowed email domains</Label>
                <Input
                  value={form.allowed_email_domains}
                  onChange={(e) => setForm((f) => ({ ...f, allowed_email_domains: e.target.value }))}
                  placeholder="dessung.gov.bt, pelsung.bt"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 px-5 py-3.5">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this institution?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.name} will disappear from sign-up.
              {archiveTarget && archiveTarget.user_count > 0
                ? ` ${archiveTarget.user_count} linked account${archiveTarget.user_count === 1 ? '' : 's'} stay attached.`
                : ' No users are currently attached.'}{' '}
              This does not delete historical registrations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={archive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
