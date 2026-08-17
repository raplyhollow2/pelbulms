'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, KeyRound, Loader2, Trash2, Video } from 'lucide-react'
import { canAccessTeaching } from '@/lib/roles'
import { createClient } from '@/lib/supabase/client'
import type { AiProvider } from '@/lib/ai-keys'

export function GeminiKeySettings({ platform = false }: { platform?: boolean }) {
  const [allowed, setAllowed] = useState(true)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/keys')
      const data = await res.json()
      if (res.status === 403) setAllowed(false)
      setStatus(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as any)?.role
      if (platform) {
        if (role !== 'superadmin') {
          setAllowed(false)
          setLoading(false)
          return
        }
      } else if (!canAccessTeaching(role)) {
        setAllowed(false)
        setLoading(false)
        return
      }
      await load()
    })()
  }, [platform])

  if (!allowed) return null
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading AI settings…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <GeminiCard platform={platform} status={status} onSaved={load} />
      <AvatarVendorsCard platform={platform} status={status} onSaved={load} />
    </div>
  )
}

function GeminiCard({
  platform,
  status,
  onSaved,
}: {
  platform: boolean
  status: any
  onSaved: () => Promise<void>
}) {
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const gemini = status?.gemini

  return (
    <Card id="ai">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {platform ? 'Platform Gemini key' : 'Gemini API key'}
        </CardTitle>
        <CardDescription>
          Paste a key from Google AI Studio. It is stored on the server and never shown in full again.
          Vercel env is optional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Open Google AI Studio and create an API key.</li>
          <li>Copy the key (it starts with AIza…).</li>
          <li>Paste it below, then Save and test.</li>
        </ol>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          render={<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" />}
        >
          Get a Gemini API key
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
        {gemini?.configured && (
          <p className="text-sm">
            Configured · ends in {gemini.last4} {gemini.source ? `(${gemini.source})` : ''}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="gemini-key">Gemini API key</Label>
          <Input
            id="gemini-key"
            type="password"
            autoComplete="off"
            className="min-h-11"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="AIza…"
          />
        </div>
        <VendorActions
          provider="gemini"
          platform={platform}
          secret={secret}
          onSecretCleared={() => setSecret('')}
          configured={Boolean(gemini?.configured && gemini.source !== 'env')}
          saving={saving}
          setSaving={setSaving}
          setMessage={setMessage}
          onSaved={onSaved}
        />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  )
}

function AvatarVendorsCard({
  platform,
  status,
  onSaved,
}: {
  platform: boolean
  status: any
  onSaved: () => Promise<void>
}) {
  return (
    <Card id="ai-avatar">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          {platform ? 'Platform avatar video keys' : 'Avatar video (paid APIs)'}
        </CardTitle>
        <CardDescription>
          Gemini cannot render a talking presenter. Paste your own HeyGen, D-ID, or Tavus key. Pelbu uses the first
          key you have saved. Secrets stay on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <HeygenFields platform={platform} status={status?.heygen} onSaved={onSaved} />
        <DidFields platform={platform} status={status?.did} onSaved={onSaved} />
        <TavusFields platform={platform} status={status?.tavus} onSaved={onSaved} />
      </CardContent>
    </Card>
  )
}

function HeygenFields({
  platform,
  status,
  onSaved,
}: {
  platform: boolean
  status: any
  onSaved: () => Promise<void>
}) {
  const [secret, setSecret] = useState('')
  const [avatarId, setAvatarId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (status?.meta?.avatarId) setAvatarId(status.meta.avatarId)
  }, [status?.meta?.avatarId])

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">HeyGen</p>
          <p className="text-xs text-muted-foreground">Talking-head videos from a script.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          render={<a href="https://app.heygen.com/settings/api" target="_blank" rel="noreferrer" />}
        >
          Get HeyGen API key
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Open HeyGen → Settings → API and create a key (paid plan).</li>
        <li>Avatars → copy the Avatar ID you want Pelbu to use.</li>
        <li>Paste both below and Save and test.</li>
      </ol>
      {status?.configured && (
        <p className="text-sm">Configured · ends in {status.last4} {status.source ? `(${status.source})` : ''}</p>
      )}
      <Label htmlFor="heygen-key">HeyGen API key</Label>
      <Input
        id="heygen-key"
        type="password"
        autoComplete="off"
        className="min-h-11"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="HeyGen API key"
      />
      <Label htmlFor="heygen-avatar">Avatar ID</Label>
      <Input
        id="heygen-avatar"
        className="min-h-11"
        value={avatarId}
        onChange={(e) => setAvatarId(e.target.value)}
        placeholder="e.g. Daisy-inskirt-20220818"
      />
      <VendorActions
        provider="heygen"
        platform={platform}
        secret={secret}
        extra={{ avatarId }}
        onSecretCleared={() => setSecret('')}
        configured={Boolean(status?.configured && status.source !== 'env')}
        saving={saving}
        setSaving={setSaving}
        setMessage={setMessage}
        onSaved={onSaved}
      />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}

function DidFields({
  platform,
  status,
  onSaved,
}: {
  platform: boolean
  status: any
  onSaved: () => Promise<void>
}) {
  const [secret, setSecret] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (status?.meta?.sourceUrl) setSourceUrl(status.meta.sourceUrl)
  }, [status?.meta?.sourceUrl])

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">D-ID</p>
          <p className="text-xs text-muted-foreground">Animate a still photo as a presenter.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          render={<a href="https://studio.d-id.com/account-settings/api-keys" target="_blank" rel="noreferrer" />}
        >
          Get D-ID API key
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Open D-ID Studio → Account settings → API keys.</li>
        <li>Paste a public HTTPS image of the presenter (head-and-shoulders works best).</li>
      </ol>
      {status?.configured && (
        <p className="text-sm">Configured · ends in {status.last4} {status.source ? `(${status.source})` : ''}</p>
      )}
      <Label htmlFor="did-key">D-ID API key</Label>
      <Input
        id="did-key"
        type="password"
        autoComplete="off"
        className="min-h-11"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="D-ID API key"
      />
      <Label htmlFor="did-source">Presenter image URL</Label>
      <Input
        id="did-source"
        className="min-h-11"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="https://…"
      />
      <VendorActions
        provider="did"
        platform={platform}
        secret={secret}
        extra={{ sourceUrl }}
        onSecretCleared={() => setSecret('')}
        configured={Boolean(status?.configured && status.source !== 'env')}
        saving={saving}
        setSaving={setSaving}
        setMessage={setMessage}
        onSaved={onSaved}
      />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}

function TavusFields({
  platform,
  status,
  onSaved,
}: {
  platform: boolean
  status: any
  onSaved: () => Promise<void>
}) {
  const [secret, setSecret] = useState('')
  const [replicaId, setReplicaId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (status?.meta?.replicaId) setReplicaId(status.meta.replicaId)
  }, [status?.meta?.replicaId])

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">Tavus</p>
          <p className="text-xs text-muted-foreground">Replica avatars from your Tavus account.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          render={<a href="https://platform.tavus.io/api-keys" target="_blank" rel="noreferrer" />}
        >
          Get Tavus API key
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Open Tavus platform → API keys.</li>
        <li>Copy a Replica ID from Replicas.</li>
      </ol>
      {status?.configured && (
        <p className="text-sm">Configured · ends in {status.last4} {status.source ? `(${status.source})` : ''}</p>
      )}
      <Label htmlFor="tavus-key">Tavus API key</Label>
      <Input
        id="tavus-key"
        type="password"
        autoComplete="off"
        className="min-h-11"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Tavus API key"
      />
      <Label htmlFor="tavus-replica">Replica ID</Label>
      <Input
        id="tavus-replica"
        className="min-h-11"
        value={replicaId}
        onChange={(e) => setReplicaId(e.target.value)}
        placeholder="r_…"
      />
      <VendorActions
        provider="tavus"
        platform={platform}
        secret={secret}
        extra={{ replicaId }}
        onSecretCleared={() => setSecret('')}
        configured={Boolean(status?.configured && status.source !== 'env')}
        saving={saving}
        setSaving={setSaving}
        setMessage={setMessage}
        onSaved={onSaved}
      />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}

function VendorActions({
  provider,
  platform,
  secret,
  extra,
  onSecretCleared,
  configured,
  saving,
  setSaving,
  setMessage,
  onSaved,
}: {
  provider: AiProvider
  platform: boolean
  secret: string
  extra?: Record<string, string>
  onSecretCleared: () => void
  configured: boolean
  saving: boolean
  setSaving: (v: boolean) => void
  setMessage: (v: string) => void
  onSaved: () => Promise<void>
}) {
  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, secret, platform, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSecretCleared()
      setMessage(`Configured · ends in ${data.last4}`)
      await onSaved()
    } catch (e: any) {
      setMessage(e?.message || 'Could not save key')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    try {
      await fetch('/api/ai/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, platform }),
      })
      await onSaved()
      setMessage('Key removed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        className="min-h-11 bg-bhutan-yellow text-black hover:bg-bhutan-orange"
        disabled={saving || (!secret.trim() && !(configured && extra))}
        onClick={() => void save()}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {secret.trim() ? 'Save and test' : 'Save IDs'}
      </Button>
      {configured && (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void remove()}>
          <Trash2 className="mr-2 h-4 w-4" />
          Remove
        </Button>
      )}
    </div>
  )
}
