'use client'

import { useEffect, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { PlatformSettings } from '@/lib/platform-settings'
import { SuperadminGate } from '@/components/admin/superadmin-gate'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { CAP } from '@/lib/capability-keys'
import { BrandLogo } from '@/components/brand/brand-logo'
import { uploadImageDirectToCloudinary } from '@/lib/cloudinary-direct-upload'

function AdminSiteSettingsPage() {
  const { has } = useCapabilities()
  const canEdit = has(CAP.SETTINGS_SITE_EDIT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    site_name: 'Rigbu LMS',
    logo_url: '',
    tagline: '',
    support_email: '',
    maintenance_mode: false,
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load settings')
        const s = data.settings as PlatformSettings
        setForm({
          site_name: s.site_name || 'Rigbu LMS',
          logo_url: s.logo_url || '',
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
          logo_url: form.logo_url.trim() || null,
          tagline: form.tagline || null,
          support_email: form.support_email || null,
          maintenance_mode: form.maintenance_mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      const savedName = data.settings?.site_name
      const savedLogo = typeof data.settings?.logo_url === 'string' ? data.settings.logo_url.trim() : ''
      window.dispatchEvent(
        new CustomEvent('rigbu:platform-identity', {
          detail: {
            siteName: typeof savedName === 'string' ? savedName.trim() : '',
            logoUrl: savedLogo || null,
          },
        })
      )
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
            Name and support contact shown across the LMS and landing page. The logo appears in the app, on sign-in, and in the browser tab.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            <div className="flex h-16 items-center justify-center rounded-lg border border-border/60 bg-muted/40 px-3">
              <BrandLogo src={form.logo_url || null} variant="horizontal" height={40} />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium">
                {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {form.logo_url ? 'Replace' : 'Add'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,.svg"
                  className="sr-only"
                  disabled={uploadingLogo || !canEdit}
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    setUploadingLogo(true)
                    try {
                      const uploaded = await uploadImageDirectToCloudinary(file, { folder: 'branding' })
                      setForm((f) => ({ ...f, logo_url: uploaded.url }))
                      toast.success(form.logo_url ? 'Logo replaced. Save to publish it.' : 'Logo added. Save to publish it.')
                    } catch (error: any) {
                      toast.error(error?.message || 'Upload failed')
                    } finally {
                      setUploadingLogo(false)
                    }
                  }}
                />
              </label>
              {form.logo_url ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  disabled={!canEdit || uploadingLogo}
                  onClick={() => setForm((f) => ({ ...f, logo_url: '' }))}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            PNG, JPEG, WebP, GIF, AVIF, or SVG. Removing it restores the built-in Rigbu mark. Save to apply.
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

      <Button onClick={save} disabled={saving || !canEdit} className="h-10">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saving ? 'Saving…' : 'Save site settings'}
      </Button>
    </div>
  )
}

export default function GatedAdminSiteSettingsPage() {
  return (
    <SuperadminGate anyOf={[CAP.SETTINGS_SITE_VIEW]}>
      <AdminSiteSettingsPage />
    </SuperadminGate>
  )
}
