'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { PlatformSettings } from '@/lib/platform-settings'

export default function AdminSiteSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    site_name: 'Pelbu LMS',
    tagline: '',
    support_email: '',
    maintenance_mode: false,
  })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load settings')
        const s = data.settings as PlatformSettings
        setForm({
          site_name: s.site_name || 'Pelbu LMS',
          tagline: s.tagline || '',
          support_email: s.support_email || '',
          maintenance_mode: !!s.maintenance_mode,
        })
      } catch (e: any) {
        toast.error(e.message || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_name: form.site_name,
          tagline: form.tagline || null,
          support_email: form.support_email || null,
          maintenance_mode: form.maintenance_mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success('Site settings saved')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading site settings…
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Platform identity</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Name and support contact shown across the LMS and landing page.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="site_name">Site name</Label>
          <Input
            id="site_name"
            value={form.site_name}
            onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            placeholder="Bhutan's private learning platform"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support_email">Support email</Label>
          <Input
            id="support_email"
            type="email"
            value={form.support_email}
            onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))}
            placeholder="support@pelbu.bt"
          />
        </div>
      </section>

      <section className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Maintenance mode</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Learners and instructors see a maintenance screen. Admins and superadmins stay in.
          </p>
        </div>
        <Switch
          checked={form.maintenance_mode}
          onCheckedChange={(checked) => setForm((f) => ({ ...f, maintenance_mode: checked }))}
        />
      </section>

      <Button onClick={save} disabled={saving} className="h-10">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saving ? 'Saving…' : 'Save site settings'}
      </Button>
    </div>
  )
}
