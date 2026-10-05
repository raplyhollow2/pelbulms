'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { AiFeature, AiFeatureRoutes, LlmProvider } from '@/lib/ai/models'

type ProviderStatus = {
  configured?: boolean
  last4?: string | null
  source?: string | null
  enabled?: boolean
  meta?: {
    model?: string
    endpoint?: string
    deployment?: string
    imageDeployment?: string
    hourlyCap?: number | null
    enabled?: boolean
  }
}

type ConfigResponse = {
  providers: Record<LlmProvider, ProviderStatus>
  routes: AiFeatureRoutes
  labels: Record<LlmProvider, string>
  features: { id: AiFeature; label: string; providers: LlmProvider[] }[]
  models: Record<Exclude<LlmProvider, 'copilot'>, string[]>
}

const ORDER: LlmProvider[] = ['claude', 'gemini', 'chatgpt', 'copilot']
const NO_MODELS: string[] = []

export function PlatformAiConsole() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [routes, setRoutes] = useState<AiFeatureRoutes | null>(null)
  const [loading, setLoading] = useState(true)
  const [routeMessage, setRouteMessage] = useState('')
  const [savingRoutes, setSavingRoutes] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/ai/config')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load AI settings')
      setConfig(data)
      setRoutes(data.routes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load AI settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const saveRoutes = async () => {
    if (!routes) return
    setSavingRoutes(true)
    setRouteMessage('')
    try {
      const res = await fetch('/api/admin/ai/routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save routing')
      setRoutes(data.routes)
      setRouteMessage('Feature routing saved.')
      await load()
    } catch (e) {
      setRouteMessage(e instanceof Error ? e.message : 'Could not save routing')
    } finally {
      setSavingRoutes(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading AI settings…
      </div>
    )
  }
  if (!config || !routes) {
    return <p className="text-sm text-destructive">{error || 'AI settings are unavailable.'}</p>
  }

  const enabledProviders = ORDER.filter((id) => config.providers[id]?.enabled && config.providers[id]?.configured)

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Language models</h2>
          <p className="text-sm text-muted-foreground">
            Keys stay on the server. Every tutor, course, quiz, and report uses the provider you assign below.
          </p>
        </div>
        {ORDER.map((id) => (
          <ProviderCard
            key={id}
            provider={id}
            label={config.labels[id]}
            status={config.providers[id]}
            models={id === 'copilot' ? NO_MODELS : config.models[id]}
            onSaved={load}
          />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Feature routing</CardTitle>
          <CardDescription>
            Each task uses one enabled provider. People in the LMS cannot switch models.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.features.map((feature) => {
            const options = feature.providers.filter((id) => enabledProviders.includes(id))
            const current = routes[feature.id]
            const choices = options.includes(current) ? options : [current, ...options]
            return (
              <div key={feature.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
                <Label htmlFor={`route-${feature.id}`}>{feature.label}</Label>
                <select
                  id={`route-${feature.id}`}
                  className="min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={current}
                  onChange={(e) =>
                    setRoutes((prev) =>
                      prev ? { ...prev, [feature.id]: e.target.value as LlmProvider } : prev
                    )
                  }
                >
                  {choices.map((id) => (
                    <option key={id} value={id}>
                      {config.labels[id]}
                      {options.includes(id) ? '' : ' (not enabled)'}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={savingRoutes}
              onClick={() => void saveRoutes()}
            >
              {savingRoutes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save routing
            </Button>
            {routeMessage ? <p className="text-sm text-muted-foreground">{routeMessage}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProviderCard({
  provider,
  label,
  status,
  models,
  onSaved,
}: {
  provider: LlmProvider
  label: string
  status: ProviderStatus
  models: string[]
  onSaved: () => Promise<void>
}) {
  const [enabled, setEnabled] = useState(Boolean(status.enabled))
  const [secret, setSecret] = useState('')
  const [model, setModel] = useState(status.meta?.model || models[0] || '')
  const [endpoint, setEndpoint] = useState(status.meta?.endpoint || '')
  const [deployment, setDeployment] = useState(status.meta?.deployment || '')
  const [imageDeployment, setImageDeployment] = useState(status.meta?.imageDeployment || '')
  const [hourlyCap, setHourlyCap] = useState(
    status.meta?.hourlyCap ? String(status.meta.hourlyCap) : ''
  )
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setEnabled(Boolean(status.enabled))
    setModel(status.meta?.model || models[0] || '')
    setEndpoint(status.meta?.endpoint || '')
    setDeployment(status.meta?.deployment || '')
    setImageDeployment(status.meta?.imageDeployment || '')
    setHourlyCap(status.meta?.hourlyCap ? String(status.meta.hourlyCap) : '')
  }, [status, models])

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/ai/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          enabled,
          secret,
          model,
          endpoint,
          deployment,
          imageDeployment,
          hourlyCap: hourlyCap.trim() ? Number(hourlyCap) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSecret('')
      setMessage(data.last4 ? `Saved · ends in ${data.last4}` : 'Saved')
      await onSaved()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed')
      setMessage(`Connected · ${data.model} replied ${data.reply}`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{label}</CardTitle>
          <CardDescription>
            {status.configured
              ? `Configured · ends in ${status.last4}${status.source ? ` (${status.source})` : ''}`
              : 'Not configured'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${provider}-enabled`}>Enabled</Label>
          <Switch id={`${provider}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`${provider}-key`}>API key</Label>
          <Input
            id={`${provider}-key`}
            type="password"
            autoComplete="off"
            className="min-h-11"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={status.configured ? 'Leave blank to keep the saved key' : 'Paste the API key'}
          />
        </div>
        {provider === 'copilot' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${provider}-endpoint`}>Azure endpoint</Label>
              <Input
                id={`${provider}-endpoint`}
                className="min-h-11"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${provider}-deployment`}>Deployment name</Label>
              <Input
                id={`${provider}-deployment`}
                className="min-h-11"
                value={deployment}
                onChange={(e) => setDeployment(e.target.value)}
                placeholder="School deployment name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${provider}-image`}>Image deployment</Label>
              <Input
                id={`${provider}-image`}
                className="min-h-11"
                value={imageDeployment}
                onChange={(e) => setImageDeployment(e.target.value)}
                placeholder="Required only if images use Copilot"
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`${provider}-model`}>Model</Label>
            <select
              id={`${provider}-model`}
              className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor={`${provider}-cap`}>Requests per person per hour</Label>
          <Input
            id={`${provider}-cap`}
            inputMode="numeric"
            className="min-h-11"
            value={hourlyCap}
            onChange={(e) => setHourlyCap(e.target.value)}
            placeholder="Blank for no cap"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={testing} onClick={() => void test()}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test connection
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
