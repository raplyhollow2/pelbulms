'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { CAP } from '@/lib/capability-keys'

type Template = {
  key: string
  label: string
  description: string
  enabled: boolean
  subject: string
  html_body: string
  text_body: string
  variables: string[]
}

type DeadLetter = { count: number; lastError: string | null }

export default function EmailTemplatesPage() {
  const { has, role, loaded } = useCapabilities()
  const canEdit = has(CAP.SETTINGS_EMAIL_TEMPLATES_EDIT) || role === 'superadmin'
  const [templates, setTemplates] = useState<Template[]>([])
  const [dead, setDead] = useState<Record<string, DeadLetter>>({})
  const [selected, setSelected] = useState<string>('')
  const [draft, setDraft] = useState<Template | null>(null)
  const [brief, setBrief] = useState('')
  const [tone, setTone] = useState('professional')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/admin/settings/email-templates')
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(payload.error || 'Could not load templates')
      return
    }
    const rows = (payload.templates || []) as Template[]
    setTemplates(rows)
    setDead(payload.dead || {})
    setSelected((current) => current || rows[0]?.key || '')
  }

  useEffect(() => {
    if (!loaded) return
    if (!has(CAP.SETTINGS_EMAIL_TEMPLATES_VIEW) && role !== 'superadmin') return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, role])

  useEffect(() => {
    const row = templates.find((item) => item.key === selected) || null
    setDraft(row ? { ...row } : null)
    setBrief('')
  }, [selected, templates])

  const save = async () => {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings/email-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: draft.key,
          enabled: draft.enabled,
          subject: draft.subject,
          htmlBody: draft.html_body,
          textBody: draft.text_body,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Could not save')
        return
      }
      toast.success('Template saved')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const testSend = async () => {
    if (!draft) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: draft.key }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Test send failed')
        return
      }
      toast.success(`Test sent to ${payload.to}`)
    } finally {
      setBusy(false)
    }
  }

  const draftWithAi = async () => {
    if (!draft || !brief.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings/email-templates/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: draft.key, brief, tone }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Could not draft this email')
        return
      }
      setDraft((current) =>
        current
          ? { ...current, subject: payload.subject, html_body: payload.html, text_body: payload.text }
          : current
      )
      toast.success('Draft inserted. Save when it looks right.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
      </div>
    )
  }

  if (!has(CAP.SETTINGS_EMAIL_TEMPLATES_VIEW) && role !== 'superadmin') {
    return <p className="text-sm text-muted-foreground">You do not have access to email templates.</p>
  }

  const failure = draft ? dead[draft.key] : undefined

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-1">
        {templates.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSelected(item.key)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
              item.key === selected ? 'bg-foreground text-background' : 'hover:bg-muted'
            }`}
          >
            <span>{item.label}</span>
            <span className="text-xs opacity-70">{item.enabled ? 'On' : 'Off'}</span>
          </button>
        ))}
      </div>
      {draft ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{draft.label}</h2>
            <p className="text-sm text-muted-foreground">{draft.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fields: {draft.variables.map((item) => `{{${item}}}`).join(', ') || 'none'}
            </p>
            {failure?.count ? (
              <p className="mt-2 text-sm text-destructive">
                {failure.count} failed send{failure.count === 1 ? '' : 's'}
                {failure.lastError ? `: ${failure.lastError}` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="template-enabled">Send this email</Label>
            <Switch
              id="template-enabled"
              checked={draft.enabled}
              disabled={!canEdit}
              onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="template-subject">Subject</Label>
            <Input
              id="template-subject"
              value={draft.subject}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="template-html">HTML</Label>
            <Textarea
              id="template-html"
              rows={8}
              value={draft.html_body}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, html_body: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="template-text">Plain text</Label>
            <Textarea
              id="template-text"
              rows={6}
              value={draft.text_body}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, text_body: event.target.value })}
            />
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Draft with AI</p>
            <p className="text-xs text-muted-foreground">
              Fills the form above. Nothing is saved or sent until you choose to.
            </p>
            <Textarea
              rows={3}
              value={brief}
              disabled={!canEdit}
              placeholder="What should this email say?"
              onChange={(event) => setBrief(event.target.value.slice(0, 2000))}
            />
            <Input value={tone} disabled={!canEdit} onChange={(event) => setTone(event.target.value.slice(0, 40))} />
            <Button type="button" variant="outline" size="sm" disabled={!canEdit || busy || !brief.trim()} onClick={() => void draftWithAi()}>
              Draft with AI
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" disabled={!canEdit || busy} onClick={() => void save()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button type="button" variant="outline" disabled={!canEdit || busy} onClick={() => void testSend()}>
              Send test to me
            </Button>
            <p className="self-center text-xs text-muted-foreground">Test uses the last saved version.</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No templates yet. Apply the database migration, then reload.</p>
      )}
    </div>
  )
}
