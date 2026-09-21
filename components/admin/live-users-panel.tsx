'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PresencePerson, PresenceSnapshot } from '@/lib/admin/presence'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media'

const ROLE_LABELS: Record<string, string> = {
  student: 'Students',
  instructor: 'Instructors',
  resource_person: 'Resource persons',
  admin: 'Admins',
  superadmin: 'Superadmins',
}

function roleLabel(role: string) {
  return ROLE_LABELS[role] || role
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function relativeTime(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function sessionLength(startedAt: string, lastSeenAt: string) {
  const ms = Math.max(0, new Date(lastSeenAt).getTime() - new Date(startedAt).getTime())
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem ? `${hours}h ${rem}m` : `${hours}h`
}

function RoleChips({ byRole }: { byRole: Record<string, number> }) {
  const entries = Object.entries(byRole).sort((a, b) => b[1] - a[1])
  if (!entries.length) {
    return <p className="text-[11px] text-muted-foreground">No sessions in this window.</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([role, count]) => (
        <span
          key={role}
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {count} {roleLabel(role).toLowerCase()}
        </span>
      ))}
    </div>
  )
}

function PersonRow({
  person,
  now,
  showLive,
}: {
  person: PresencePerson
  now: number
  showLive: boolean
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="relative shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={resolveMediaUrl(person.avatarUrl) || undefined} alt={person.fullName} />
          <AvatarFallback className="bg-bhutan-yellow/20 text-[11px] font-semibold text-foreground">
            {initials(person.fullName)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card',
            person.live
              ? person.status === 'idle'
                ? 'bg-amber-400'
                : 'bg-emerald-500'
              : 'bg-muted-foreground/40'
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{person.fullName}</p>
          <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {showLive && person.live
              ? person.pathLabel
              : relativeTime(person.lastSeenAt, now)}
          </p>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {roleLabel(person.role)}
          {person.live
            ? person.status === 'idle'
              ? ` · idle · ${person.pathLabel}`
              : ` · ${sessionLength(person.sessionStartedAt, person.lastSeenAt)} this session`
            : person.leftReason === 'logout'
              ? ' · signed out'
              : ' · left'}
        </p>
      </div>
    </li>
  )
}

export function LiveUsersPanel({ className }: { className?: string }) {
  const [tab, setTab] = useState<'now' | 'today'>('now')
  const [presence, setPresence] = useState<PresenceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/presence?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load presence')
      setPresence(data.presence as PresenceSnapshot)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load presence')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const tick = window.setInterval(() => setNow(Date.now()), 5000)
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60000)

    const supabase = createClient()
    let debounce: number | null = null
    const channel = supabase
      .channel('admin-user-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => {
          if (debounce) window.clearTimeout(debounce)
          debounce = window.setTimeout(() => void load(), 2000)
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(tick)
      window.clearInterval(poll)
      if (debounce) window.clearTimeout(debounce)
      void supabase.removeChannel(channel)
    }
  }, [load])

  const people = tab === 'now' ? presence?.activeNow || [] : presence?.activeToday || []
  const empty =
    tab === 'now' ? 'No one is in the LMS right now.' : 'No sessions yet today.'

  const freshness = useMemo(() => {
    if (!presence) return ''
    const seconds = Math.max(
      0,
      Math.round((now - new Date(presence.generatedAt).getTime()) / 1000)
    )
    if (seconds < 3) return 'live'
    if (seconds < 60) return `${seconds}s ago`
    return `${Math.floor(seconds / 60)}m ago`
  }, [now, presence])

  return (
    <section className={cn('rounded-xl border border-border/60 bg-card p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Active users</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Concurrent sessions vs unique people since midnight (Bhutan time). Logout and closed
            tabs drop off; background tabs stay in Active now as idle.
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {freshness || 'connecting'}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTab('now')}
          className={cn(
            'rounded-xl border p-4 text-left transition-colors',
            tab === 'now'
              ? 'border-bhutan-orange/40 bg-bhutan-yellow/10'
              : 'border-border/60 hover:bg-muted/40'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Active now
            </p>
            <Activity className="h-3.5 w-3.5 text-bhutan-orange" />
          </div>
          <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight">
            {presence?.counts.now ?? (loading ? '—' : 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Open in the LMS now</p>
          <div className="mt-3">
            <RoleChips byRole={presence?.counts.nowByRole || {}} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTab('today')}
          className={cn(
            'rounded-xl border p-4 text-left transition-colors',
            tab === 'today'
              ? 'border-bhutan-orange/40 bg-bhutan-yellow/10'
              : 'border-border/60 hover:bg-muted/40'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Active today
            </p>
            <Users className="h-3.5 w-3.5 text-bhutan-orange" />
          </div>
          <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight">
            {presence?.counts.today ?? (loading ? '—' : 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Unique since 12:00am Thimphu</p>
          <div className="mt-3">
            <RoleChips byRole={presence?.counts.todayByRole || {}} />
          </div>
        </button>
      </div>

      <div className="mt-4 border-t border-border/50 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {tab === 'now' ? 'Currently in the LMS' : 'Sessions today'}
        </p>
        {loading && !presence ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading live roster…
          </p>
        ) : error && !presence ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : people.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="mt-1 max-h-80 divide-y divide-border/40 overflow-y-auto">
            {people.slice(0, 40).map((person) => (
              <PersonRow
                key={person.userId}
                person={person}
                now={now}
                showLive={tab === 'now'}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
