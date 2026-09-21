'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = {
  id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
  base_archetype: string
  is_assignable: boolean
  all_institutions: boolean
  sort_order: number
}

type Capability = {
  id: string
  key: string
  label: string
  cap_group: 'menu' | 'module'
  menu_key: string
  parent_menu_key: string | null
  action: string
  sort_order: number
}

type Institution = {
  id: string
  name: string
  display_name?: string | null
}

const MENU_ACTIONS = ['view', 'add', 'edit', 'delete', 'configure'] as const
const MODULE_ACTIONS = ['view', 'configure'] as const

export function PermissionsMatrix() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [grantsByRole, setGrantsByRole] = useState<Record<string, string[]>>({})
  const [institutionsByRole, setInstitutionsByRole] = useState<Record<string, string[]>>({})
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [archetypes, setArchetypes] = useState<string[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [dirtyCaps, setDirtyCaps] = useState<Set<string>>(new Set())
  const [dirtyInst, setDirtyInst] = useState<Set<string>>(new Set())
  const [allInstitutions, setAllInstitutions] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newArchetype, setNewArchetype] = useState('admin')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/roles')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setRoles(data.roles || [])
      setCapabilities(data.capabilities || [])
      setGrantsByRole(data.grantsByRole || {})
      setInstitutionsByRole(data.institutionsByRole || {})
      setInstitutions(data.institutions || [])
      setArchetypes(data.archetypes || [])
      setSelectedRoleId((prev) => {
        if (prev && (data.roles || []).some((r: Role) => r.id === prev)) return prev
        return data.roles?.[0]?.id ?? null
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  )

  useEffect(() => {
    if (!selectedRole) return
    setDirtyCaps(new Set(grantsByRole[selectedRole.id] || []))
    setDirtyInst(new Set(institutionsByRole[selectedRole.id] || []))
    setAllInstitutions(selectedRole.all_institutions)
  }, [selectedRole, grantsByRole, institutionsByRole])

  const menuCaps = useMemo(
    () => capabilities.filter((c) => c.cap_group === 'menu'),
    [capabilities]
  )
  const moduleCaps = useMemo(
    () => capabilities.filter((c) => c.cap_group === 'module'),
    [capabilities]
  )

  const menuRows = useMemo(() => {
    const byKey = new Map<string, { menu_key: string; label: string; parent: string | null; caps: Capability[] }>()
    for (const c of menuCaps) {
      if (!byKey.has(c.menu_key)) {
        byKey.set(c.menu_key, {
          menu_key: c.menu_key,
          label: c.label,
          parent: c.parent_menu_key,
          caps: [],
        })
      }
      byKey.get(c.menu_key)!.caps.push(c)
    }
    return Array.from(byKey.values()).sort((a, b) => {
      const ao = a.caps[0]?.sort_order ?? 0
      const bo = b.caps[0]?.sort_order ?? 0
      return ao - bo
    })
  }, [menuCaps])

  const moduleRows = useMemo(() => {
    const byKey = new Map<string, { menu_key: string; label: string; caps: Capability[] }>()
    for (const c of moduleCaps) {
      if (!byKey.has(c.menu_key)) {
        byKey.set(c.menu_key, { menu_key: c.menu_key, label: c.label, caps: [] })
      }
      byKey.get(c.menu_key)!.caps.push(c)
    }
    return Array.from(byKey.values()).sort(
      (a, b) => (a.caps[0]?.sort_order ?? 0) - (b.caps[0]?.sort_order ?? 0)
    )
  }, [moduleCaps])

  const toggleCap = (capId: string, on: boolean) => {
    setDirtyCaps((prev) => {
      const next = new Set(prev)
      if (on) next.add(capId)
      else next.delete(capId)
      return next
    })
  }

  const toggleRowAll = (caps: Capability[], on: boolean) => {
    setDirtyCaps((prev) => {
      const next = new Set(prev)
      for (const c of caps) {
        if (on) next.add(c.id)
        else next.delete(c.id)
      }
      return next
    })
  }

  const capForAction = (caps: Capability[], action: string) =>
    caps.find((c) => c.action === action)

  const save = async () => {
    if (!selectedRole) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/roles/${selectedRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          all_institutions: allInstitutions,
          capability_ids: Array.from(dirtyCaps),
          institution_ids: allInstitutions ? [] : Array.from(dirtyInst),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      await load()
      window.dispatchEvent(new Event('pelbu:capabilities-changed'))
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createRole = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          base_archetype: newArchetype,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setCreateOpen(false)
      setNewName('')
      await load()
      if (data.role?.id) setSelectedRoleId(data.role.id)
    } catch (e: any) {
      setError(e?.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const deleteRole = async () => {
    if (!selectedRole || selectedRole.is_system) return
    if (!confirm(`Delete custom role “${selectedRole.name}”? Users will fall back to ${selectedRole.base_archetype}.`)) {
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/roles/${selectedRole.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setSelectedRoleId(null)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading permissions…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* Profiles list */}
        <aside className="w-full shrink-0 rounded-xl border bg-card lg:w-56">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Profiles</h2>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto p-1">
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selectedRoleId === role.id
                      ? 'bg-sky-600 text-white'
                      : 'hover:bg-muted'
                  )}
                >
                  <span className="block font-medium">{role.name}</span>
                  {!role.is_system && (
                    <span
                      className={cn(
                        'text-[11px]',
                        selectedRoleId === role.id ? 'text-sky-100' : 'text-muted-foreground'
                      )}
                    >
                      custom · {role.base_archetype}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main panels */}
        <div className="min-w-0 flex-1 space-y-4">
          {selectedRole && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{selectedRole.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedRole.is_system ? 'System role' : 'Custom role'} · archetype{' '}
                    {selectedRole.base_archetype}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!selectedRole.is_system && (
                    <Button variant="outline" size="sm" onClick={deleteRole} disabled={saving}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              {/* Institution permissions */}
              <section className="rounded-xl border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Institution Permissions</h3>
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allInstitutions}
                    onCheckedChange={(v) => setAllInstitutions(Boolean(v))}
                  />
                  All institutions
                </label>
                {!allInstitutions && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {institutions.map((inst) => {
                      const checked = dirtyInst.has(inst.id)
                      return (
                        <label key={inst.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setDirtyInst((prev) => {
                                const next = new Set(prev)
                                if (v) next.add(inst.id)
                                else next.delete(inst.id)
                                return next
                              })
                            }}
                          />
                          {inst.display_name || inst.name}
                        </label>
                      )
                    })}
                    {institutions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No institutions yet.</p>
                    )}
                  </div>
                )}
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                {/* Menu permissions */}
                <section className="overflow-x-auto rounded-xl border bg-card">
                  <div className="border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Menu Permissions</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Menus</th>
                        {MENU_ACTIONS.map((a) => (
                          <th key={a} className="px-2 py-2 text-center font-medium capitalize">
                            {a}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-medium">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={MENU_ACTIONS.length + 2}
                            className="px-3 py-6 text-center text-sm text-muted-foreground"
                          >
                            No menu capabilities in the catalog yet.
                          </td>
                        </tr>
                      )}
                      {menuRows.map((row) => {
                        const available = MENU_ACTIONS.filter((a) => capForAction(row.caps, a))
                        const allOn =
                          available.length > 0 &&
                          available.every((a) => {
                            const c = capForAction(row.caps, a)
                            return c && dirtyCaps.has(c.id)
                          })
                        return (
                          <tr
                            key={row.menu_key}
                            className={cn(
                              'border-b last:border-0',
                              row.parent && 'bg-muted/20'
                            )}
                          >
                            <td
                              className={cn(
                                'px-3 py-2',
                                row.parent ? 'pl-8 text-muted-foreground' : 'font-medium'
                              )}
                            >
                              {row.label}
                            </td>
                            {MENU_ACTIONS.map((action) => {
                              const cap = capForAction(row.caps, action)
                              if (!cap) {
                                return (
                                  <td key={action} className="px-2 py-2 text-center text-muted-foreground/40">
                                    —
                                  </td>
                                )
                              }
                              return (
                                <td key={action} className="px-2 py-2 text-center">
                                  <Checkbox
                                    checked={dirtyCaps.has(cap.id)}
                                    onCheckedChange={(v) => toggleCap(cap.id, Boolean(v))}
                                  />
                                </td>
                              )
                            })}
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={allOn}
                                onCheckedChange={(v) => toggleRowAll(row.caps, Boolean(v))}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </section>

                {/* Modules */}
                <section className="overflow-x-auto rounded-xl border bg-card">
                  <div className="border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Modules Permissions</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Modules</th>
                        {MODULE_ACTIONS.map((a) => (
                          <th key={a} className="px-2 py-2 text-center font-medium capitalize">
                            {a}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-medium">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moduleRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={MODULE_ACTIONS.length + 2}
                            className="px-3 py-6 text-center text-sm text-muted-foreground"
                          >
                            No module capabilities in the catalog yet.
                          </td>
                        </tr>
                      )}
                      {moduleRows.map((row) => {
                        const allOn = row.caps.every((c) => dirtyCaps.has(c.id))
                        return (
                          <tr key={row.menu_key} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{row.label}</td>
                            {MODULE_ACTIONS.map((action) => {
                              const cap = capForAction(row.caps, action)
                              if (!cap) {
                                return (
                                  <td key={action} className="px-2 py-2 text-center text-muted-foreground/40">
                                    —
                                  </td>
                                )
                              }
                              return (
                                <td key={action} className="px-2 py-2 text-center">
                                  <Checkbox
                                    checked={dirtyCaps.has(cap.id)}
                                    onCheckedChange={(v) => toggleCap(cap.id, Boolean(v))}
                                  />
                                </td>
                              )
                            })}
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={allOn && row.caps.length > 0}
                                onCheckedChange={(v) => toggleRowAll(row.caps, Boolean(v))}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create custom role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Front Office Manager"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Clone from archetype</Label>
              <Select value={newArchetype} onValueChange={setNewArchetype}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(archetypes.length ? archetypes : ['admin', 'instructor', 'student']).map(
                    (a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Capabilities and coarse routing (teach/admin) inherit from this base.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createRole} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
