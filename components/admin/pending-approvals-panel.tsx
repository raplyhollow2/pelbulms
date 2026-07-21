'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
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
  RefreshCw,
  Mail,
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
  { value: 'instructor', label: 'Instructor' },
  { value: 'resource_person', label: 'Resource person' },
  { value: 'admin', label: 'Admin' },
]

function docUrl(path: string | null) {
  if (!path) return null
  return `/api/register/document?path=${encodeURIComponent(path)}`
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

function statusClass(status: string) {
  switch (status) {
    case 'additional_info_requested':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
    case 'under_review':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    default:
      return 'border-border bg-muted/60 text-muted-foreground'
  }
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
          'flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-muted/30 text-muted-foreground',
          className
        )}
      >
        <ImageOff className="h-4 w-4" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(url, label)}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border/60 bg-muted/40 text-left outline-none transition-colors hover:border-bhutan-orange/40 focus-visible:ring-2 focus-visible:ring-bhutan-orange/40',
        className
      )}
      title={`View ${label}`}
      aria-label={`View ${label}`}
    >
      {!loaded && !failed && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </span>
      )}
      {failed ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <ImageOff className="h-4 w-4" />
          <span className="text-[10px]">Unavailable</span>
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
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-5">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-white">
          {label}
        </span>
        <Maximize2 className="h-3 w-3 shrink-0 text-white/80 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  )
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function roleLabel(value: string | null | undefined) {
  return ROLE_OPTIONS.find((r) => r.value === value)?.label || value || 'Student'
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
      <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-border/60 bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading approvals…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Registration queue</h2>
          <p className="text-sm text-muted-foreground">
            Review KYC documents, assign a role, then approve or reject.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
            {registrations.length} pending
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={load}
            disabled={busyId !== null}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {!error && registrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/50 px-4 py-14 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No pending registrations</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            New applicants will appear here after they submit their KYC form.
          </p>
        </div>
      ) : !error ? (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="hidden border-b border-border/50 bg-muted/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground xl:grid xl:grid-cols-[8.5rem_minmax(0,1.35fr)_minmax(0,1fr)_10rem] xl:gap-4 xl:px-5">
            <span>Documents</span>
            <span>Applicant</span>
            <span>Decision</span>
            <span className="text-right">Actions</span>
          </div>

          <ul className="divide-y divide-border/50">
            {registrations.map((reg) => {
              const location = [reg.gewog, reg.dzongkhag].filter(Boolean).join(', ')
              const assigned = roleChoice[reg.id] || reg.requested_role || 'student'
              const busy = busyId === reg.id

              return (
                <li
                  key={reg.id}
                  className="px-4 py-4 sm:px-5 xl:grid xl:grid-cols-[8.5rem_minmax(0,1.35fr)_minmax(0,1fr)_10rem] xl:items-start xl:gap-4 xl:py-4"
                >
                  {/* KYC thumbs */}
                  <div className="mb-4 grid grid-cols-2 gap-2 xl:mb-0">
                    <LazyKycThumb
                      path={reg.passport_photo_url}
                      label="Photo"
                      onOpen={openPreview}
                      className="aspect-[3/4] h-auto w-full xl:aspect-auto xl:h-[5.25rem]"
                    />
                    <LazyKycThumb
                      path={reg.cid_photo_url}
                      label="CID"
                      onOpen={openPreview}
                      className="aspect-[3/4] h-auto w-full xl:aspect-auto xl:h-[5.25rem]"
                    />
                  </div>

                  {/* Applicant */}
                  <div className="mb-4 min-w-0 space-y-2 xl:mb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold leading-snug">
                        {reg.full_name}
                      </p>
                      <span
                        className={cn(
                          'inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium capitalize tracking-wide',
                          statusClass(reg.registration_status)
                        )}
                      >
                        {statusLabel(reg.registration_status)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex min-w-0 items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{reg.email}</span>
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1.5">
                          <IdCard className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium text-foreground">{reg.cid_number}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {reg.phone_number}
                        </span>
                      </div>
                      {(location || reg.class) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {location}
                            </span>
                          )}
                          {reg.class && (
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 shrink-0" />
                              {reg.class}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Submitted {formatWhen(reg.submitted_at)}
                      {reg.requested_role
                        ? ` · requested ${roleLabel(reg.requested_role)}`
                        : ''}
                    </p>
                  </div>

                  {/* Decision */}
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:mb-0 xl:grid-cols-1">
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`role-${reg.id}`}
                        className="text-[11px] font-medium text-muted-foreground"
                      >
                        Assign role
                      </label>
                      <Select
                        value={assigned}
                        onValueChange={(v) =>
                          setRoleChoice((s) => ({ ...s, [reg.id]: v ?? 'student' }))
                        }
                      >
                        <SelectTrigger id={`role-${reg.id}`} className="h-10 w-full text-sm">
                          <SelectValue>
                            {(v: string | null) => roleLabel(v)}
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
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`notes-${reg.id}`}
                        className="text-[11px] font-medium text-muted-foreground"
                      >
                        Notes / rejection reason
                      </label>
                      <Textarea
                        id={`notes-${reg.id}`}
                        rows={2}
                        className="min-h-10 resize-none text-sm"
                        value={notes[reg.id] || ''}
                        onChange={(e) =>
                          setNotes((s) => ({ ...s, [reg.id]: e.target.value }))
                        }
                        placeholder="Optional for approve · required context for reject"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 xl:flex-col xl:items-stretch">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => act(reg, 'approve')}
                      className="h-10 flex-1 gap-1.5 bg-emerald-600 text-sm text-white hover:bg-emerald-700 xl:flex-none"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      variant="outline"
                      onClick={() => act(reg, 'reject')}
                      className="h-10 flex-1 gap-1.5 border-destructive/30 text-sm text-destructive hover:bg-destructive/10 xl:flex-none"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border/50 px-5 py-3">
            <DialogTitle className="text-sm">{preview?.label || 'Document'}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[80dvh] items-center justify-center bg-black/90 p-3">
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
