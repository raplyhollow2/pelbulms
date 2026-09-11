'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, GraduationCap, IdCard, Loader2, UserRound, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PlatformSettings } from '@/lib/platform-settings'

type FormState = {
  require_identity_documents: boolean
  require_qualification: boolean
  require_student_id: boolean
  require_emergency_contact: boolean
  require_tos_consent: boolean
  collect_hear_about_us: boolean
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{title}</Label>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </div>
  )
}

export default function AdminRegistrationSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>({
    require_identity_documents: true,
    require_qualification: false,
    require_student_id: false,
    require_emergency_contact: false,
    require_tos_consent: false,
    collect_hear_about_us: false,
  })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load settings')
        const s = data.settings as PlatformSettings
        setForm({
          require_identity_documents: s.require_identity_documents,
          require_qualification: s.require_qualification,
          require_student_id: s.require_student_id,
          require_emergency_contact: s.require_emergency_contact,
          require_tos_consent: s.require_tos_consent,
          collect_hear_about_us: s.collect_hear_about_us,
        })
      } catch (e: any) {
        toast.error(e.message || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const previewSteps = useMemo(() => {
    const steps = [{ id: 'personal', title: 'Personal', icon: UserRound }]
    if (form.require_identity_documents) steps.push({ id: 'identity', title: 'Identity', icon: IdCard })
    steps.push({ id: 'institution', title: 'Institution', icon: Building2 })
    if (form.require_qualification) steps.push({ id: 'academic', title: 'Academic', icon: GraduationCap })
    return steps
  }, [form.require_identity_documents, form.require_qualification])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success('Registration policy saved')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading registration policy…
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-6">
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-semibold">Mandatory verification</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Global for every institution. Turning identity documents off skips CID and photos
            and activates student accounts immediately. Teaching roles still need superadmin review.
          </p>
          <div className="mt-4">
            <ToggleRow
              title="CID and identity photos"
              description="Require CID number, passport photo, CID photo, and home location (dzongkhag / gewog)."
              checked={form.require_identity_documents}
              onCheckedChange={(v) => setForm((f) => ({ ...f, require_identity_documents: v }))}
            />
            <ToggleRow
              title="Qualification / academic background"
              description="Require education level on the Academic step. Off keeps that step hidden."
              checked={form.require_qualification}
              onCheckedChange={(v) => setForm((f) => ({ ...f, require_qualification: v }))}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="text-sm font-semibold">Additional fields</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Common LMS registration extras. Off by default so Bhutan government cohorts stay lean.
          </p>
          <div className="mt-4">
            <ToggleRow
              title="Student / staff ID"
              description="Collect a Dessung, Pelsung, or other cohort ID (stored as student ID)."
              checked={form.require_student_id}
              onCheckedChange={(v) => setForm((f) => ({ ...f, require_student_id: v }))}
            />
            <ToggleRow
              title="Emergency contact"
              description="Require an emergency contact name and phone number."
              checked={form.require_emergency_contact}
              onCheckedChange={(v) => setForm((f) => ({ ...f, require_emergency_contact: v }))}
            />
            <ToggleRow
              title="Terms of service consent"
              description="Require applicants to accept terms before submitting."
              checked={form.require_tos_consent}
              onCheckedChange={(v) => setForm((f) => ({ ...f, require_tos_consent: v }))}
            />
            <ToggleRow
              title="“How did you hear about us?”"
              description="Optional marketing attribution field on sign-up."
              checked={form.collect_hear_about_us}
              onCheckedChange={(v) => setForm((f) => ({ ...f, collect_hear_about_us: v }))}
            />
          </div>
        </section>

        <Button onClick={save} disabled={saving} className="h-10">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save registration policy'}
        </Button>
      </div>

      <aside className="h-fit rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Sign-up preview
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {form.require_identity_documents
            ? 'Students wait in the approval queue after submit.'
            : 'Students get catalog access immediately after submit.'}
        </p>
        <ol className="mt-4 space-y-2">
          {previewSteps.map((s, i) => {
            const Icon = s.icon
            return (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border text-xs',
                    i === 0
                      ? 'border-transparent bg-gradient-to-br from-bhutan-yellow to-bhutan-orange text-black'
                      : 'border-border bg-background text-muted-foreground'
                  )}
                >
                  {i === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span>
                  {i + 1}. {s.title}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Coming later: timezone, accessibility needs, qualification certificate upload.
        </p>
      </aside>
    </div>
  )
}
