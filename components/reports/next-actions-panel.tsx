'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { InterventionSuggestedKind, ReportAction } from '@/lib/reports/types'
import { toast } from 'sonner'

export type InterveneLearnerOption = {
  studentId: string
  courseId: string
  label: string
}

export function NextActionsPanel({
  actions,
  learners = [],
  onInterveneDone,
}: {
  actions: ReportAction[]
  /** At-risk (or similar) learners for the intervene picker. */
  learners?: InterveneLearnerOption[]
  onInterveneDone?: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [kind, setKind] = useState<InterventionSuggestedKind>('at_risk')
  const [busy, setBusy] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [courseId, setCourseId] = useState('')

  const startIntervene = (action: ReportAction) => {
    setOpenId(action.id)
    setKind(action.suggestedKind || 'at_risk')
    const first =
      learners.find(
        (l) =>
          l.courseId === action.target?.courseId &&
          (!action.target?.studentId || l.studentId === action.target.studentId)
      ) || learners[0]
    setStudentId(action.target?.studentId || first?.studentId || '')
    setCourseId(action.target?.courseId || first?.courseId || '')
    setMessage(
      action.suggestedKind === 'nudge'
        ? 'A quick reminder to continue your course this week.'
        : 'We noticed you may need support — please reopen your course and message us if you are stuck.'
    )
  }

  const submitIntervene = async (action: ReportAction) => {
    const cid = courseId.trim() || action.target?.courseId
    const sid = studentId.trim() || action.target?.studentId
    if (!cid || !sid) {
      toast.error('Select a learner to intervene')
      return
    }
    if (!message.trim()) {
      toast.error('Message is required')
      return
    }
    try {
      setBusy(true)
      const res = await fetch('/api/teach/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: cid,
          studentId: sid,
          kind,
          message: message.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to send intervention')
      const email = json.email as { sent?: boolean; skipped?: boolean; error?: string } | undefined
      if (email?.sent) toast.success('Intervention saved and email sent')
      else if (email?.skipped) toast.success('Intervention saved (email skipped)')
      else if (email?.error) toast.success(`Intervention saved; email failed: ${email.error}`)
      else toast.success('Intervention saved')
      setOpenId(null)
      onInterveneDone?.()
    } catch (e: any) {
      toast.error(e.message || 'Failed to intervene')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="bg-card/80 border border-border">
      <CardHeader>
        <CardTitle className="text-base">Next actions</CardTitle>
        <CardDescription>Prioritized follow-ups to improve outcomes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-border/50 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="mr-2 text-primary">{a.priority}.</span>
                  {a.title}
                </p>
                <p className="text-sm text-muted-foreground">{a.reason}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
                {a.kind === 'intervene' && a.target?.courseId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => startIntervene(a)}
                  >
                    <Mail className="mr-1 h-3.5 w-3.5" />
                    Intervene
                  </Button>
                ) : null}
                <Link
                  href={a.href}
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {openId === a.id ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                {learners.length > 0 ? (
                  <label className="block text-sm">
                    <span className="text-muted-foreground">Learner</span>
                    <select
                      value={`${courseId}:${studentId}`}
                      onChange={(e) => {
                        const [c, s] = e.target.value.split(':')
                        setCourseId(c || '')
                        setStudentId(s || '')
                      }}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2"
                    >
                      {learners.map((l) => (
                        <option key={`${l.courseId}:${l.studentId}`} value={`${l.courseId}:${l.studentId}`}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Open the at-risk table or learner page if no learners are listed here.
                  </p>
                )}
                <label className="block text-sm">
                  <span className="text-muted-foreground">Kind</span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as InterventionSuggestedKind)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2"
                  >
                    <option value="at_risk">At risk</option>
                    <option value="nudge">Nudge</option>
                    <option value="question">Question</option>
                    <option value="note">Note</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Message (emailed to learner)</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void submitIntervene(a)}
                  >
                    {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Send + email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setOpenId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
