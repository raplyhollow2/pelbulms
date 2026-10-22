'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Sparkles, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type PresetKey = 'low_progress' | 'inactive' | 'stuck' | 'custom'

type InterventionRow = {
  id: string
  student_id?: string
  kind?: string
  message?: string
  created_at?: string
}

function firstName(fullName: string) {
  const part = fullName.trim().split(/\s+/)[0]
  return part || 'there'
}

function presetMessage(
  key: PresetKey,
  studentName: string,
  courseTitle: string
): string {
  const name = firstName(studentName)
  const course = courseTitle.trim() || 'your course'
  switch (key) {
    case 'low_progress':
      return `Hi ${name}, I noticed your progress in ${course} is still low. A short session this week can help you catch up — reopen the course when you can, and message me if you need support.`
    case 'inactive':
      return `Hi ${name}, we have not seen you active in ${course} recently. Whenever you are ready, jump back in and continue from where you left off. I am here if anything is blocking you.`
    case 'stuck':
      return `Hi ${name}, if you are stuck on a lesson or assessment in ${course}, please reply or reach out — I am happy to help you get unstuck.`
    case 'custom':
    default:
      return ''
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'low_progress', label: 'Low progress' },
  { key: 'inactive', label: 'Inactive / come back' },
  { key: 'stuck', label: 'Stuck — need help?' },
  { key: 'custom', label: 'Custom' },
]

export function StudentFollowUpPanel({
  courseId,
  studentId,
  studentName,
  courseTitle,
  progressPct,
  lastAccessedAt,
}: {
  courseId: string
  studentId: string
  studentName: string
  courseTitle: string
  progressPct: number
  lastAccessedAt?: string | null
}) {
  const [preset, setPreset] = useState<PresetKey>('low_progress')
  const [message, setMessage] = useState(() =>
    presetMessage('low_progress', studentName, courseTitle)
  )
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [recent, setRecent] = useState<InterventionRow[]>([])

  const lowProgress = progressPct < 30
  const inactiveHint = useMemo(() => {
    if (!lastAccessedAt) return true
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 7
    return new Date(lastAccessedAt).getTime() < cutoff
  }, [lastAccessedAt])

  const applyPreset = (key: PresetKey) => {
    setPreset(key)
    setMessage(presetMessage(key, studentName, courseTitle))
  }

  const loadRecent = async () => {
    try {
      const res = await fetch(`/api/teach/interventions?courseId=${encodeURIComponent(courseId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return
      const rows = (data.interventions || []) as InterventionRow[]
      setRecent(rows.filter((row) => row.student_id === studentId).slice(0, 3))
    } catch {
      // ignore history load failures
    }
  }

  useEffect(() => {
    void loadRecent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, studentId])

  useEffect(() => {
    if (preset === 'custom') return
    setMessage(presetMessage(preset, studentName, courseTitle))
  }, [studentName, courseTitle, preset])

  const draftWithAi = async () => {
    setDrafting(true)
    try {
      const res = await fetch('/api/teach/interventions/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          studentId,
          brief: message.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not draft message')
      const drafted = String(data.message || '').trim()
      if (!drafted) throw new Error('The draft was empty')
      setPreset('custom')
      setMessage(drafted)
      toast.success('AI draft ready — edit before sending')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not draft message')
    } finally {
      setDrafting(false)
    }
  }

  const sendReminder = async () => {
    if (!message.trim()) {
      toast.error('Message is required')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/teach/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          studentId,
          kind: 'nudge',
          message: message.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder')
      const email = data.email as
        | { sent?: boolean; skipped?: boolean; error?: string }
        | undefined
      if (email?.sent) toast.success('Reminder saved and email sent')
      else if (email?.skipped) toast.success('Reminder saved (email skipped)')
      else if (email?.error) toast.success(`Reminder saved; email failed: ${email.error}`)
      else toast.success('Reminder saved')
      setMessage(presetMessage(preset === 'custom' ? 'low_progress' : preset, studentName, courseTitle))
      if (preset === 'custom') setPreset('low_progress')
      await loadRecent()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send reminder')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Follow-up
        </CardTitle>
        <CardDescription>
          Email this learner a reminder and post an in-app notice. Choose a preset or draft with AI,
          then edit before sending.
        </CardDescription>
        {(lowProgress || inactiveHint) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {lowProgress && (
              <Badge variant="secondary" className="font-normal">
                Low progress ({progressPct}%)
              </Badge>
            )}
            {inactiveHint && (
              <Badge variant="secondary" className="font-normal">
                Inactive (7d+)
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => applyPreset(item.key)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                preset === item.key
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Textarea
          value={message}
          onChange={(e) => {
            setPreset('custom')
            setMessage(e.target.value)
          }}
          rows={5}
          placeholder="Write a reminder for this learner…"
          maxLength={2000}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void draftWithAi()}
            disabled={drafting || sending}
          >
            {drafting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Draft with AI
          </Button>
          <Button type="button" onClick={() => void sendReminder()} disabled={sending || drafting}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send reminder
          </Button>
        </div>

        {recent.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Recent follow-ups</p>
            <ul className="space-y-2">
              {recent.map((row) => (
                <li key={row.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{row.kind || 'note'}</span>
                    {row.created_at && (
                      <span>· {new Date(row.created_at).toLocaleString()}</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/90">{row.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
