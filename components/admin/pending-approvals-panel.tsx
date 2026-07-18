'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ClipboardCheck, Check, X, FileText, Phone, MapPin, IdCard } from 'lucide-react'

type Registration = {
  id: string
  user_id: string
  full_name: string
  email: string
  phone_number: string
  cid_number: string
  passport_photo_url: string | null
  cid_photo_url: string | null
  requested_role: string | null
  dzongkhag: string | null
  gewog: string | null
  class: string | null
  registration_status: string
  submitted_at: string
}

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Teacher / Instructor' },
  { value: 'resource_person', label: 'Resource Person' },
  { value: 'admin', label: 'Admin' },
]

function docUrl(path: string | null) {
  if (!path) return null
  return `/api/register/document?path=${encodeURIComponent(path)}`
}

export function PendingApprovalsPanel({
  onCountChange,
}: {
  onCountChange?: (count: number) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [roleChoice, setRoleChoice] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals')
      const data = await res.json()
      if (res.status === 403) {
        throw new Error(
          data.message ||
            'You cannot approve registrations for any institution yet.'
        )
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to load')
      const pendingStatuses = new Set(['submitted', 'under_review', 'additional_info_requested'])
      const list = (data.registrations || []).filter((r: Registration) =>
        pendingStatuses.has(r.registration_status)
      )
      setRegistrations(list)
      onCountChange?.(list.length)
    } catch (e: any) {
      setError(e.message)
      onCountChange?.(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const act = async (reg: Registration, action: 'approve' | 'reject') => {
    setBusyId(reg.id)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          registrationId: reg.id,
          userId: reg.user_id,
          assignedRole: roleChoice[reg.id] || reg.requested_role || 'student',
          reviewNotes: notes[reg.id] || null,
          rejectionReason: action === 'reject' ? notes[reg.id] || 'Not approved' : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'Action failed')
      setRegistrations((prev) => {
        const next = prev.filter((r) => r.id !== reg.id)
        onCountChange?.(next.length)
        return next
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-bhutan-yellow" />
        <span className="ml-2 text-sm text-muted-foreground">Loading approvals…</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight sm:text-base">Pending registrations</h2>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Review KYC, confirm role, then approve or reject.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && registrations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center">
          <ClipboardCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">No pending registrations</p>
          <p className="mt-0.5 text-xs text-muted-foreground">New submissions will appear here.</p>
        </div>
      ) : !error ? (
        <div className="space-y-2.5">
          {registrations.map((reg) => (
            <div
              key={reg.id}
              className="overflow-hidden rounded-xl border border-border/50 bg-card/70"
            >
              {/* Identity header */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/40 px-3 py-2.5 sm:px-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">{reg.full_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{reg.email}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                    {reg.registration_status?.replace(/_/g, ' ') || 'pending'}
                  </Badge>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    Req: {reg.requested_role || 'student'}
                  </Badge>
                </div>
              </div>

              {/* Compact KYC detail */}
              <div className="space-y-3 px-3 py-3 sm:px-4">
                <div className="grid gap-1.5 text-xs sm:grid-cols-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <IdCard className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground">CID {reg.cid_number}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground">{reg.phone_number}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground">
                      {[reg.gewog, reg.dzongkhag].filter(Boolean).join(', ') || '—'}
                    </span>
                  </span>
                  {reg.class && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-foreground">{reg.class}</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {docUrl(reg.passport_photo_url) && (
                    <a href={docUrl(reg.passport_photo_url)!} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                        <FileText className="h-3 w-3" /> Passport
                      </Button>
                    </a>
                  )}
                  {docUrl(reg.cid_photo_url) && (
                    <a href={docUrl(reg.cid_photo_url)!} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                        <IdCard className="h-3 w-3" /> CID photo
                      </Button>
                    </a>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Assign role
                    </label>
                    <Select
                      value={roleChoice[reg.id] || reg.requested_role || 'student'}
                      onValueChange={(v) =>
                        setRoleChoice((s) => ({ ...s, [reg.id]: v ?? 'student' }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue>
                          {(v: string | null) =>
                            ROLE_OPTIONS.find((r) => r.value === v)?.label || 'Select role'
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Notes
                    </label>
                    <Textarea
                      rows={1}
                      className="min-h-8 resize-none text-xs"
                      value={notes[reg.id] || ''}
                      onChange={(e) => setNotes((s) => ({ ...s, [reg.id]: e.target.value }))}
                      placeholder="Review notes / rejection reason"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === reg.id}
                    onClick={() => act(reg, 'approve')}
                    className="h-8 flex-1 gap-1 bg-green-600 text-xs text-white hover:bg-green-700"
                  >
                    {busyId === reg.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === reg.id}
                    variant="outline"
                    onClick={() => act(reg, 'reject')}
                    className="h-8 flex-1 gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
