'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Send } from 'lucide-react'

type Student = {
  id: string
  full_name?: string | null
  email?: string | null
  enrollment?: {
    progress_percentage?: number | null
    last_accessed_at?: string | null
    status?: string
  }
}

export function StudentInterventionPanel({
  courseId,
  students,
}: {
  courseId: string
  students: Student[]
}) {
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [kind, setKind] = useState<'nudge' | 'note' | 'question'>('nudge')
  const [saving, setSaving] = useState(false)
  const [log, setLog] = useState<any[]>([])
  const [quizFails, setQuizFails] = useState<any[]>([])
  const [openQuestions, setOpenQuestions] = useState<any[]>([])

  const atRisk = useMemo(() => {
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 7
    const failIds = new Set(quizFails.map((f) => f.studentId))
    const questionIds = new Set(openQuestions.map((q) => q.studentId))
    return students.filter((s) => {
      if (s.enrollment?.status && s.enrollment.status !== 'active') return false
      const pct = s.enrollment?.progress_percentage || 0
      const last = s.enrollment?.last_accessed_at
        ? new Date(s.enrollment.last_accessed_at).getTime()
        : 0
      return pct < 30 || last < cutoff || failIds.has(s.id) || questionIds.has(s.id)
    })
  }, [students, quizFails, openQuestions])

  const load = async () => {
    const res = await fetch(`/api/teach/interventions?courseId=${courseId}`)
    const data = await res.json()
    if (res.ok) {
      setLog(data.interventions || [])
      setQuizFails(data.quizFails || [])
      setOpenQuestions(data.openQuestions || [])
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const send = async () => {
    if (!selectedId || !message.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/teach/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, studentId: selectedId, kind, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setMessage('')
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to send')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Interventions
        </CardTitle>
        <CardDescription>
          Students with low progress, no activity in 7 days, a failed quiz, or an unanswered question.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {atRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">No at-risk students right now.</p>
          ) : (
            atRisk.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  selectedId === s.id
                    ? 'border-transparent bg-bhutan-yellow text-black'
                    : 'border-border'
                }`}
              >
                {s.full_name || s.email}
                <span className="ml-1 opacity-70">{Math.round(s.enrollment?.progress_percentage || 0)}%</span>
              </button>
            ))
          )}
        </div>
        {(quizFails.length > 0 || openQuestions.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {quizFails.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Failed quizzes</p>
                <ul className="space-y-1 text-sm">
                  {quizFails.slice(0, 6).map((row, i) => (
                    <li key={`${row.studentId}-${i}`}>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setSelectedId(row.studentId)}
                      >
                        {row.quizTitle} · {row.score}%
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {openQuestions.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Unanswered questions</p>
                <ul className="space-y-1 text-sm">
                  {openQuestions.slice(0, 6).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setSelectedId(row.studentId)}
                      >
                        {row.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select a student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.email}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {(['nudge', 'note', 'question'] as const).map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={kind === k ? 'default' : 'outline'}
              className="min-h-11 capitalize"
              onClick={() => setKind(k)}
            >
              {k}
            </Button>
          ))}
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a reminder, answer a question, or log an outreach note…"
          rows={3}
        />
        <Button
          type="button"
          className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
          disabled={saving || !selectedId || !message.trim()}
          onClick={() => void send()}
        >
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
        <ul className="space-y-2">
          {log.slice(0, 8).map((row) => (
            <li key={row.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {row.kind}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </div>
              <p>{row.message}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
