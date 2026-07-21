'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  ClipboardCheck,
  Check,
  X,
  Phone,
  MapPin,
  IdCard,
  ImageOff,
  Maximize2,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  institution_id?: string | null
}

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Teacher' },
  { value: 'resource_person', label: 'Resource Person' },
  { value: 'admin', label: 'Admin' },
]

function docUrl(path: string | null) {
  if (!path) return null
  return `/api/register/document?path=${encodeURIComponent(path)}`
}

/** Loads KYC media only when near the viewport — avoids hammering signed-URL API. */
function LazyKycThumb({
  path,
  label,
  onOpen,
  className,
}: {
  path: string | null
  label: string
  onOpen: (src: string, label: string) => void
  className?: string
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [active, setActive] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const url = docUrl(path)

  useEffect(() => {
    const el = ref.current
    if (!el || !url) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true)
          io.disconnect()
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [url])

  if (!url) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border/60 bg-muted/30 text-muted-foreground',
          className
        )}
      >
        <ImageOff className="h-3.5 w-3.5" />
        <span className="text-[9px] font-medium uppercase tracking-wide">{label}</span>
      </div>
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(url, label)}
      className={cn(
        'group relative overflow-hidden rounded-md border border-border/50 bg-muted/40 text-left outline-none transition-colors hover:border-bhutan-orange/50 focus-visible:ring-2 focus-visible:ring-bhutan-orange/40',
        className
      )}
      title={`View ${label}`}
    >
      {!loaded && !failed && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </span>
      )}
      {failed ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
          <ImageOff className="h-3.5 w-3.5" />
          <span className="text-[9px]">Unavailable</span>
        </span>
      ) : active ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className={cn(
            'h-full w-full object-cover transition-opacity duration-200',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4">
        <span className="truncate text-[9px] font-semibold uppercase tracking-wide text-white">
          {label}
        </span>
        <Maximize2 className="h-2.5 w-2.5 shrink-0 text-white/80 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  )
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
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
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null)

  const openPreview = useCallback((src: string, label: string) => {
    setPreview({ src, label })
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals')
      const data = await res.json()
      if (res.status === 403) {
        throw new Error(
          data.message || 'You cannot approve registrations for any institution yet.'
        )
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to load')
      const pendingStatuses = new Set([
        'submitted',
        'under_review',
        'additional_info_requested',
      ])
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
      if (data.result?.success === false) {
        throw new Error(data.result.error || data.message || 'Action failed')
      }
      const next = registrations.filter((r) => r.id !== reg.id)
      setRegistrations(next)
      onCountChange?.(next.length)
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
        <span className="ml-2 text-sm text-muted-foreground">Loading queue…</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight sm:text-base">Approval queue</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            KYC preview · confirm role · approve or reject
          </p>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {registrations.length} pending
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && registrations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center">
          <ClipboardCheck className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium">Queue clear</p>
          <p className="mt-0.5 text-xs text-muted-foreground">New submissions will appear here.</p>
        </div>
      ) : !error ? (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/60">
          {/* Desktop column headers */}
          <div className="hidden border-b border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1fr)_9.5rem] lg:gap-3 lg:px-4">
            <span>Documents</span>
            <span>Applicant</span>
            <span>Decision</span>
            <span className="text-right">Actions</span>
          </div>

          <ul className="divide-y divide-border/40">
            {registrations.map((reg) => {
              const location = [reg.gewog, reg.dzongkhag].filter(Boolean).join(', ')
              return (
                <li
                  key={reg.id}
                  className="px-3 py-3 sm:px-4 lg:grid lg:grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1fr)_9.5rem] lg:items-start lg:gap-3 lg:py-2.5"
                >
                  {/* KYC thumbs — always visible, lazy-loaded */}
                  <div className="mb-2.5 grid grid-cols-2 gap-1.5 lg:mb-0">
                    <LazyKycThumb
                      path={reg.passport_photo_url}
                      label="Photo"
                      onOpen={openPreview}
                      className="aspect-[3/4] h-auto w-full lg:aspect-auto lg:h-[4.75rem]"
                    />
                    <LazyKycThumb
                      path={reg.cid_photo_url}
                      label="CID"
                      onOpen={openPreview}
                      className="aspect-[3/4] h-auto w-full lg:aspect-auto lg:h-[4.75rem]"
                    />
                  </div>

                  {/* Applicant meta */}
                  <div className="mb-2.5 min-w-0 space-y-1 lg:mb-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {reg.full_name}
                      </p>
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[9px] capitalize"
                      >
                        {reg.registration_status?.replace(/_/g, ' ') || 'pending'}
                      </Badge>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{reg.email}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <IdCard className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground">{reg.cid_number}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        {reg.phone_number}
                      </span>
                      {location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {location}
                        </span>
                      )}
                      {reg.class && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          {reg.class}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80">
                      Submitted {formatWhen(reg.submitted_at)}
                      {reg.requested_role ? ` · requested ${reg.requested_role}` : ''}
                    </p>
                  </div>

                  {/* Role + notes */}
                  <div className="mb-2.5 grid gap-1.5 sm:grid-cols-2 lg:mb-0 lg:grid-cols-1">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                              ROLE_OPTIONS.find((r) => r.value === v)?.label || 'Role'
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
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Notes
                      </label>
                      <Textarea
                        rows={1}
                        className="min-h-8 resize-none py-1.5 text-xs"
                        value={notes[reg.id] || ''}
                        onChange={(e) =>
                          setNotes((s) => ({ ...s, [reg.id]: e.target.value }))
                        }
                        placeholder="Optional note / reject reason"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 lg:flex-col lg:items-stretch">
                    <Button
                      size="sm"
                      disabled={busyId === reg.id}
                      onClick={() => act(reg, 'approve')}
                      className="h-8 flex-1 gap-1 bg-green-600 text-xs text-white hover:bg-green-700 lg:flex-none"
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
                      className="h-8 flex-1 gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 lg:flex-none"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {/* Full-size preview — only loads when opened (src already from lazy thumb) */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border/50 px-4 py-2.5">
            <DialogTitle className="text-sm">{preview?.label || 'Document'}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[80dvh] items-center justify-center bg-black/90 p-2">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.src}
                alt={preview.label}
                className="max-h-[78dvh] w-full object-contain"
                decoding="async"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
