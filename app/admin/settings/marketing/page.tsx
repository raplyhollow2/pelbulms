'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import type { PlatformSettings } from '@/lib/platform-settings'

type CourseOpt = { id: string; title: string; is_published: boolean }

export default function AdminMarketingSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courses, setCourses] = useState<CourseOpt[]>([])
  const [form, setForm] = useState({
    landing_headline: '',
    landing_description: '',
    public_catalog: true,
    featured_course_ids: [] as string[],
  })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load settings')
        const s = data.settings as PlatformSettings
        setForm({
          landing_headline: s.landing_headline || '',
          landing_description: s.landing_description || '',
          public_catalog: s.public_catalog !== false,
          featured_course_ids: s.featured_course_ids || [],
        })
        setCourses(data.courses || [])
      } catch (e: any) {
        toast.error(e.message || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleFeatured = (id: string, on: boolean) => {
    setForm((f) => ({
      ...f,
      featured_course_ids: on
        ? [...f.featured_course_ids, id]
        : f.featured_course_ids.filter((x) => x !== id),
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landing_headline: form.landing_headline || null,
          landing_description: form.landing_description || null,
          public_catalog: form.public_catalog,
          featured_course_ids: form.featured_course_ids,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success('Marketing settings saved')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading marketing settings…
      </div>
    )
  }

  const published = courses.filter((c) => c.is_published)

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Landing page</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Overrides the default headline and description. Leave blank to keep the built-in copy.
            KYC wording on the homepage follows the identity-documents toggle.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landing_headline">Headline</Label>
          <Input
            id="landing_headline"
            value={form.landing_headline}
            onChange={(e) => setForm((f) => ({ ...f, landing_headline: e.target.value }))}
            placeholder="Advanced learning for Bhutan"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landing_description">Description</Label>
          <Textarea
            id="landing_description"
            rows={4}
            value={form.landing_description}
            onChange={(e) => setForm((f) => ({ ...f, landing_description: e.target.value }))}
          />
        </div>
      </section>

      <section className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold">Public catalog highlights</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Show featured published courses on the public homepage.
          </p>
        </div>
        <Switch
          checked={form.public_catalog}
          onCheckedChange={(checked) => setForm((f) => ({ ...f, public_catalog: checked }))}
        />
      </section>

      {form.public_catalog && (
        <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-semibold">Featured courses</h2>
          {published.length === 0 ? (
            <p className="text-xs text-muted-foreground">No published courses yet.</p>
          ) : (
            <ul className="space-y-2">
              {published.map((c) => {
                const on = form.featured_course_ids.includes(c.id)
                return (
                  <li key={c.id} className="flex items-center gap-2.5">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) => toggleFeatured(c.id, v === true)}
                    />
                    <span className="text-sm">{c.title}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <Button onClick={save} disabled={saving} className="h-10">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saving ? 'Saving…' : 'Save marketing settings'}
      </Button>
    </div>
  )
}
