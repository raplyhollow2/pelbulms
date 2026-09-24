'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { SuperadminGate } from '@/components/admin/superadmin-gate'
import { CAP } from '@/lib/capability-keys'

type CloudinaryConnectionStatus = {
  configured: boolean
  source: 'database' | 'environment' | 'none'
  cloudName: string | null
  apiKeyLast4: string | null
  secretLast4: string | null
}

const EMPTY_STATUS: CloudinaryConnectionStatus = {
  configured: false,
  source: 'none',
  cloudName: null,
  apiKeyLast4: null,
  secretLast4: null,
}

function CloudinarySettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<CloudinaryConnectionStatus>(EMPTY_STATUS)
  const [cloudName, setCloudName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [confirmSwitch, setConfirmSwitch] = useState(false)

  const switching =
    Boolean(status.configured && status.cloudName) &&
    cloudName.trim() !== '' &&
    cloudName.trim() !== status.cloudName

  const load = async () => {
    const res = await fetch('/api/admin/settings/cloudinary')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load Cloudinary settings')
    const next = data as CloudinaryConnectionStatus
    setStatus(next)
    setCloudName(next.cloudName || '')
    setApiKey('')
    setApiSecret('')
    setConfirmSwitch(false)
  }

  useEffect(() => {
    ;(async () => {
      try {
        await load()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to load Cloudinary settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const credentials = () => ({
    cloudName: cloudName.trim(),
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
  })

  const testConnection = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/settings/cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ...credentials() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection test failed')
      toast.success('Cloudinary accepted these credentials')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    if (switching && !confirmSwitch) {
      toast.error('Confirm the account switch before saving')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/cloudinary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...credentials(),
          confirmAccountSwitch: switching && confirmSwitch,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setStatus(data as CloudinaryConnectionStatus)
      setCloudName((data as CloudinaryConnectionStatus).cloudName || '')
      setApiKey('')
      setApiSecret('')
      setConfirmSwitch(false)
      toast.success('Cloudinary account saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/admin/settings/cloudinary', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not disconnect')
      const next = data as CloudinaryConnectionStatus
      setStatus(next)
      setCloudName(next.cloudName || '')
      setApiKey('')
      setApiSecret('')
      setConfirmSwitch(false)
      toast.success(
        next.source === 'environment'
          ? 'Saved account removed. Environment variables are in use again.'
          : 'Cloudinary account disconnected'
      )
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Cloudinary settings…
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Connection</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Private videos and images use this Cloudinary account. A saved account overrides
            environment variables.
          </p>
        </div>
        <p className="text-sm">
          {status.configured ? (
            <>
              Connected to <span className="font-medium">{status.cloudName}</span>
              {status.source === 'database' ? ' (saved in site administration)' : ' (environment variables)'}
              {status.apiKeyLast4 ? `. API key ending ${status.apiKeyLast4}` : ''}
              {status.secretLast4 ? `, secret ending ${status.secretLast4}` : ''}.
            </>
          ) : (
            'Not connected. Uploads stay unavailable until an account is saved or environment variables are set.'
          )}
        </p>
        {status.source === 'database' ? (
          <Button
            type="button"
            variant="outline"
            onClick={disconnect}
            disabled={disconnecting || saving}
          >
            {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Disconnect saved account
          </Button>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">
            {status.source === 'database' ? 'Replace account' : 'Connect account'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enter the cloud name, API key, and API secret from the Cloudinary console. The secret
            is stored on the server and is not shown again.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cloud_name">Cloud name</Label>
          <Input
            id="cloud_name"
            value={cloudName}
            autoComplete="off"
            onChange={(e) => {
              setCloudName(e.target.value)
              setConfirmSwitch(false)
            }}
            placeholder="your-cloud-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api_key">API key</Label>
          <Input
            id="api_key"
            value={apiKey}
            autoComplete="off"
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status.apiKeyLast4 ? `Current key ends ${status.apiKeyLast4}` : 'API key'}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api_secret">API secret</Label>
          <Input
            id="api_secret"
            type="password"
            value={apiSecret}
            autoComplete="new-password"
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder={
              status.secretLast4 ? `Current secret ends ${status.secretLast4}` : 'API secret'
            }
          />
        </div>
        {switching ? (
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={confirmSwitch}
              onCheckedChange={(value) => setConfirmSwitch(value === true)}
            />
            <span>
              Switch from <span className="font-medium">{status.cloudName}</span> to this account.
              Videos and images already uploaded stay on the previous account and will not play
              until they are uploaded again.
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={testConnection} disabled={testing || saving}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test connection
          </Button>
          <Button type="button" onClick={save} disabled={saving || testing}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save Cloudinary account'}
          </Button>
        </div>
      </section>
    </div>
  )
}

export default function GatedCloudinarySettingsPage() {
  return (
    <SuperadminGate anyOf={[CAP.SETTINGS_VIEW]}>
      <CloudinarySettingsPage />
    </SuperadminGate>
  )
}
