'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { CAP } from '@/lib/capability-keys'

type EmailProvider = 'resend' | 'gmail_smtp' | 'smtp'

type EmailHostStatus = {
  id: string
  name: string
  provider: EmailProvider
  fromName: string | null
  fromEmail: string
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUsername: string | null
  secretLast4: string | null
  isDefault: boolean
}

type EmailHostList = {
  hosts: EmailHostStatus[]
  envFallback: { configured: boolean; from: string | null }
}

type Draft = {
  id?: string
  name: string
  provider: EmailProvider
  fromName: string
  fromEmail: string
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUsername: string
  secret: string
  isDefault: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '',
  provider: 'resend',
  fromName: 'Pelbu LMS',
  fromEmail: '',
  smtpHost: '',
  smtpPort: '587',
  smtpSecure: false,
  smtpUsername: '',
  secret: '',
  isDefault: true,
}

const PROVIDER_LABEL: Record<EmailProvider, string> = {
  resend: 'Resend',
  gmail_smtp: 'Gmail SMTP',
  smtp: 'Custom SMTP',
}

const HOST_TYPE_ITEMS = [
  { value: 'resend', label: 'Resend' },
  { value: 'gmail_smtp', label: 'Gmail SMTP' },
  { value: 'smtp', label: 'Custom SMTP' },
]

const GMAIL_PORT_ITEMS = [
  { value: '587', label: '587 (STARTTLS)' },
  { value: '465', label: '465 (SSL)' },
]

function applyProvider(draft: Draft, provider: EmailProvider): Draft {
  if (provider === 'gmail_smtp') {
    return {
      ...draft,
      provider,
      smtpHost: 'smtp.gmail.com',
      smtpPort: draft.smtpPort === '465' ? '465' : '587',
      smtpSecure: draft.smtpPort === '465',
      smtpUsername: draft.smtpUsername || draft.fromEmail,
    }
  }
  if (provider === 'resend') {
    return { ...draft, provider, smtpHost: '', smtpUsername: '', smtpSecure: false }
  }
  return { ...draft, provider }
}

function draftFromHost(host: EmailHostStatus): Draft {
  return {
    id: host.id,
    name: host.name,
    provider: host.provider,
    fromName: host.fromName || '',
    fromEmail: host.fromEmail,
    smtpHost: host.smtpHost || '',
    smtpPort: host.smtpPort ? String(host.smtpPort) : '587',
    smtpSecure: host.smtpSecure,
    smtpUsername: host.smtpUsername || '',
    secret: '',
    isDefault: host.isDefault,
  }
}

function payload(draft: Draft) {
  return {
    id: draft.id,
    name: draft.name,
    provider: draft.provider,
    fromName: draft.fromName,
    fromEmail: draft.fromEmail,
    smtpHost: draft.smtpHost,
    smtpPort: draft.smtpPort ? Number(draft.smtpPort) : null,
    smtpSecure: draft.smtpSecure || draft.smtpPort === '465',
    smtpUsername: draft.smtpUsername,
    secret: draft.secret,
    isDefault: draft.isDefault,
  }
}

function EmailsSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<EmailHostList>({ hosts: [], envFallback: { configured: false, from: null } })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/settings/email-hosts')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load email hosts')
    setStatus(data as EmailHostList)
  }

  useEffect(() => {
    ;(async () => {
      try {
        await load()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to load email hosts')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key)
    try {
      await work()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(null)
    }
  }

  const save = () => {
    if (!draft) return
    void run('save', async () => {
      const res = await fetch('/api/admin/settings/email-hosts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(draft)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setStatus(data as EmailHostList)
      setDraft(null)
      toast.success('Email host saved')
    })
  }

  const testDraft = () => {
    if (!draft) return
    void run('test-draft', async () => {
      const res = await fetch('/api/admin/settings/email-hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ...payload(draft) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection test failed')
      toast.success('Connection succeeded')
    })
  }

  const sendDraft = () => {
    if (!draft) return
    void run('send-draft', async () => {
      const res = await fetch('/api/admin/settings/email-hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-test', ...payload(draft) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test email was not sent')
      toast.success(`Test email sent to ${data.to}`)
    })
  }

  const hostAction = (key: string, url: string, init: RequestInit, success: string) => {
    void run(key, async () => {
      const res = await fetch(url, init)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      if (data.hosts) setStatus(data as EmailHostList)
      toast.success(success)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading email hosts…
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Email hosts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Automated mail uses the default host. Resend is the recommended host for enrollment,
            approval, and grading messages. Gmail SMTP is available when you want mail to come from
            a Google Workspace address. Secrets are stored on the server and are not shown again.
          </p>
        </div>
        <p className="text-sm">
          {status.envFallback.configured ? (
            <>
              If no host is saved, Pelbu falls back to the Resend environment variable
              {status.envFallback.from ? ` (${status.envFallback.from})` : ''}.
            </>
          ) : (
            'No Resend environment variable is set. Save a host before automated email can send.'
          )}
        </p>
        <Button
          type="button"
          onClick={() =>
            setDraft({
              ...EMPTY_DRAFT,
              isDefault: status.hosts.length === 0,
            })
          }
          disabled={Boolean(draft && !draft.id)}
        >
          Add email host
        </Button>
      </section>

      {status.hosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No email hosts saved yet.</p>
      ) : (
        <ul className="space-y-3">
          {status.hosts.map((host) => (
            <li key={host.id} className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {host.name}{' '}
                    {host.isDefault ? (
                      <span className="ml-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">
                        Default
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {PROVIDER_LABEL[host.provider]} · {host.fromName ? `${host.fromName} ` : ''}
                    &lt;{host.fromEmail}&gt;
                    {host.secretLast4 ? ` · secret ending ${host.secretLast4}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {host.isDefault ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      hostAction(
                        `default-${host.id}`,
                        '/api/admin/settings/email-hosts',
                        {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: host.id }),
                        },
                        `${host.name} is now the default host`
                      )
                    }
                  >
                    Make default
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    hostAction(
                      `test-${host.id}`,
                      '/api/admin/settings/email-hosts',
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'test', id: host.id }),
                      },
                      'Connection succeeded'
                    )
                  }
                >
                  Test connection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    hostAction(
                      `send-${host.id}`,
                      '/api/admin/settings/email-hosts',
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'send-test', id: host.id }),
                      },
                      'Test email sent'
                    )
                  }
                >
                  Send test email
                </Button>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setDraft(draftFromHost(host))}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`Remove ${host.name}?`)) return
                    hostAction(
                      `delete-${host.id}`,
                      `/api/admin/settings/email-hosts?id=${encodeURIComponent(host.id)}`,
                      { method: 'DELETE' },
                      'Email host removed'
                    )
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold">{draft.id ? 'Edit host' : 'New host'}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {draft.provider === 'gmail_smtp' ? (
                <>
                  Gmail will not accept your account password. Turn on 2-Step Verification, then create an{' '}
                  <a
                    className="underline"
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                  >
                    app password
                  </a>{' '}
                  and paste that 16-character password below.
                </>
              ) : draft.provider === 'smtp' ? (
                'Use the host, port, and credentials from your mail provider.'
              ) : (
                'Paste the Resend API key and the from address that Resend is allowed to send as.'
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="host_name">Name</Label>
            <Input
              id="host_name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="School Resend"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="host_provider">Host type</Label>
            <Select
              items={HOST_TYPE_ITEMS}
              value={draft.provider}
              onValueChange={(value) => {
                if (value === 'resend' || value === 'gmail_smtp' || value === 'smtp') {
                  setDraft((current) => (current ? applyProvider(current, value) : current))
                }
              }}
            >
              <SelectTrigger id="host_provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="gmail_smtp">Gmail SMTP</SelectItem>
                <SelectItem value="smtp">Custom SMTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="from_name">From name</Label>
              <Input
                id="from_name"
                value={draft.fromName}
                autoComplete="off"
                onChange={(e) => setDraft({ ...draft, fromName: e.target.value })}
                placeholder="Pelbu LMS"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="from_email">From email</Label>
              <Input
                id="from_email"
                type="email"
                value={draft.fromEmail}
                autoComplete="off"
                onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })}
                placeholder={draft.provider === 'resend' ? 'noreply@pelbu.bt' : 'school@gmail.com'}
              />
            </div>
          </div>
          {draft.provider === 'smtp' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="smtp_host">SMTP host</Label>
                <Input
                  id="smtp_host"
                  value={draft.smtpHost}
                  autoComplete="off"
                  onChange={(e) => setDraft({ ...draft, smtpHost: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtp_port">Port</Label>
                <Input
                  id="smtp_port"
                  inputMode="numeric"
                  value={draft.smtpPort}
                  onChange={(e) => setDraft({ ...draft, smtpPort: e.target.value })}
                  placeholder="587"
                />
              </div>
            </div>
          ) : null}
          {draft.provider === 'gmail_smtp' ? (
            <div className="space-y-1.5">
              <Label htmlFor="gmail_port">Port</Label>
              <Select
                items={GMAIL_PORT_ITEMS}
                value={draft.smtpPort === '465' ? '465' : '587'}
                onValueChange={(value) => {
                  if (value !== '465' && value !== '587') return
                  setDraft((current) =>
                    current
                      ? { ...current, smtpPort: value, smtpSecure: value === '465', smtpHost: 'smtp.gmail.com' }
                      : current
                  )
                }}
              >
                <SelectTrigger id="gmail_port" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="587">587 (STARTTLS)</SelectItem>
                  <SelectItem value="465">465 (SSL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {draft.provider !== 'resend' ? (
            <div className="space-y-1.5">
              <Label htmlFor="smtp_username">{draft.provider === 'gmail_smtp' ? 'Gmail address' : 'Username'}</Label>
              <Input
                id="smtp_username"
                value={draft.smtpUsername}
                autoComplete="off"
                onChange={(e) => setDraft({ ...draft, smtpUsername: e.target.value })}
                placeholder={draft.provider === 'gmail_smtp' ? 'school@gmail.com' : 'smtp-user'}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="host_secret">{draft.provider === 'resend' ? 'API key' : 'Password'}</Label>
            <Input
              id="host_secret"
              type="password"
              value={draft.secret}
              autoComplete="new-password"
              onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
              placeholder={draft.id ? 'Leave blank to keep the saved secret' : draft.provider === 'resend' ? 're_...' : 'App password'}
            />
          </div>
          {draft.provider === 'smtp' ? (
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={draft.smtpSecure}
                onCheckedChange={(value) => setDraft({ ...draft, smtpSecure: value === true })}
              />
              <span>Use implicit TLS (typical for port 465).</span>
            </label>
          ) : null}
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={draft.isDefault}
              onCheckedChange={(value) => setDraft({ ...draft, isDefault: value === true })}
            />
            <span>Use this host for automated email.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={testDraft} disabled={busy !== null}>
              {busy === 'test-draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test connection
            </Button>
            <Button type="button" variant="outline" onClick={sendDraft} disabled={busy !== null}>
              {busy === 'send-draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send test email
            </Button>
            <Button type="button" onClick={save} disabled={busy !== null}>
              {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save host
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default function GatedEmailsSettingsPage() {
  const router = useRouter()
  const { loaded, role, has } = useCapabilities()
  const allowed = role === 'superadmin' || has(CAP.SETTINGS_EMAILS_VIEW)

  useEffect(() => {
    if (!loaded) return
    if (!allowed) router.push('/dashboard')
  }, [allowed, loaded, router])

  if (!loaded || !allowed) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
      </div>
    )
  }

  return <EmailsSettingsPage />
}
