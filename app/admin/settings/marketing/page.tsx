'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { CAP } from '@/lib/capability-keys'
import type { PlatformSettings } from '@/lib/platform-settings'
import {
  VIDEO_QUALITY_OPTIONS,
  type VideoQualityPreference,
} from '@/lib/video-quality'
import {
  DEFAULT_HERO_CTA_PRIMARY,
  DEFAULT_HERO_ROTATING_WORDS,
  DEFAULT_HERO_VIDEO_URL,
  DEFAULT_LANDING_FAQ,
  DEFAULT_LANDING_FEATURES,
  DEFAULT_LANDING_SECTION_TITLES,
  DEFAULT_LANDING_STATS,
  DEFAULT_LANDING_STEPS,
  LANDING_ICON_KEYS,
  type LandingCampusCard,
  type LandingFaqItem,
  type LandingFeature,
  type LandingQuote,
  type LandingSectionTitles,
  type LandingStat,
  type LandingStep,
} from '@/lib/landing-content'
import { getYoutubeId } from '@/lib/video-url'
import { uploadImageDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import { YoutubeFrame } from '@/components/course/youtube-frame'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CourseOpt = { id: string; title: string; is_published: boolean }

type FormState = {
  landing_headline: string
  landing_description: string
  hero_video_url: string
  /** Empty string = unset (start at 0) */
  hero_video_start_seconds: string
  /** Empty string = play to end of video */
  hero_video_end_seconds: string
  video_quality: VideoQualityPreference
  hero_rotating_words: string
  hero_cta_primary_label: string
  hero_cta_secondary_label: string
  hero_image_url: string
  hero_glass_opacity: number
  landing_stats: LandingStat[]
  landing_features: LandingFeature[]
  landing_steps: LandingStep[]
  landing_faq: LandingFaqItem[]
  landing_campus: LandingCampusCard[]
  landing_quotes: LandingQuote[]
  landing_gallery: string[]
  landing_section_titles: LandingSectionTitles
  public_catalog: boolean
  featured_course_ids: string[]
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(nextIndex, 0, item)
  return next
}

function secondsToInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(Math.floor(value))
}

function parseSecondsInput(raw: string, { allowZero }: { allowZero: boolean }): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (allowZero ? n < 0 : n <= 0) return null
  return n
}

function settingsToForm(s: PlatformSettings): FormState {
  return {
    landing_headline: s.landing_headline || '',
    landing_description: s.landing_description || '',
    hero_video_url: s.hero_video_url || '',
    hero_video_start_seconds: secondsToInput(s.hero_video_start_seconds),
    hero_video_end_seconds: secondsToInput(s.hero_video_end_seconds),
    video_quality: s.video_quality || 'high',
    hero_rotating_words: (s.hero_rotating_words?.length
      ? s.hero_rotating_words
      : DEFAULT_HERO_ROTATING_WORDS
    ).join(', '),
    hero_cta_primary_label: s.hero_cta_primary_label || DEFAULT_HERO_CTA_PRIMARY,
    hero_cta_secondary_label: s.hero_cta_secondary_label || '',
    hero_image_url: s.hero_image_url || '',
    hero_glass_opacity: s.hero_glass_opacity ?? 70,
    landing_stats: Array.isArray(s.landing_stats) ? s.landing_stats : [...DEFAULT_LANDING_STATS],
    landing_features: Array.isArray(s.landing_features)
      ? s.landing_features
      : DEFAULT_LANDING_FEATURES.map((f) => ({ ...f })),
    landing_steps: Array.isArray(s.landing_steps)
      ? s.landing_steps
      : DEFAULT_LANDING_STEPS.map((st) => ({ ...st })),
    landing_campus: s.landing_campus || [],
    landing_quotes: s.landing_quotes || [],
    landing_gallery: s.landing_gallery || [],
    landing_faq: s.landing_faq?.length
      ? s.landing_faq
      : DEFAULT_LANDING_FAQ.map((f) => ({ ...f })),
    landing_section_titles: {
      ...DEFAULT_LANDING_SECTION_TITLES,
      ...s.landing_section_titles,
    },
    public_catalog: s.public_catalog !== false,
    featured_course_ids: s.featured_course_ids || [],
  }
}

export default function AdminMarketingSettingsPage() {
  const { has } = useCapabilities()
  const canEdit = has(CAP.SETTINGS_MARKETING_EDIT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewFrame, setPreviewFrame] = useState<'phone' | 'desktop'>('phone')
  const [previewKey, setPreviewKey] = useState(0)
  const [courses, setCourses] = useState<CourseOpt[]>([])
  const [form, setForm] = useState<FormState>(() =>
    settingsToForm({
      landing_headline: null,
      landing_description: null,
      hero_video_url: DEFAULT_HERO_VIDEO_URL,
      hero_video_start_seconds: null,
      hero_video_end_seconds: null,
      video_quality: 'high',
      hero_rotating_words: [...DEFAULT_HERO_ROTATING_WORDS],
      hero_cta_primary_label: DEFAULT_HERO_CTA_PRIMARY,
      hero_cta_secondary_label: null,
      hero_image_url: null,
      hero_glass_opacity: 70,
      landing_stats: [...DEFAULT_LANDING_STATS],
      landing_campus: [],
      landing_quotes: [],
      landing_gallery: [],
      landing_features: null,
      landing_steps: null,
      landing_faq: null,
      landing_section_titles: {},
      public_catalog: true,
      featured_course_ids: [],
    } as PlatformSettings)
  )

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load settings')
        const s = data.settings as PlatformSettings
        setForm(settingsToForm(s))
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
      const startSec = parseSecondsInput(form.hero_video_start_seconds, { allowZero: true })
      const endSec = parseSecondsInput(form.hero_video_end_seconds, { allowZero: false })
      if (form.hero_video_start_seconds.trim() && startSec == null) {
        throw new Error('Loop start must be a whole number of seconds (≥ 0)')
      }
      if (form.hero_video_end_seconds.trim() && endSec == null) {
        throw new Error('Loop end must be a whole number of seconds (> 0)')
      }
      if (startSec != null && endSec != null && endSec <= startSec) {
        throw new Error('Loop end must be greater than loop start')
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landing_headline: form.landing_headline || null,
          landing_description: form.landing_description || null,
          hero_video_url: form.hero_video_url || null,
          hero_video_start_seconds: startSec,
          hero_video_end_seconds: endSec,
          video_quality: form.video_quality,
          hero_rotating_words: form.hero_rotating_words,
          hero_cta_primary_label: form.hero_cta_primary_label || null,
          hero_cta_secondary_label: form.hero_cta_secondary_label || null,
          hero_image_url: form.hero_image_url || null,
          hero_glass_opacity: form.hero_glass_opacity,
          landing_stats: form.landing_stats,
          landing_features: form.landing_features,
          landing_steps: form.landing_steps,
          landing_faq: form.landing_faq,
          landing_campus: form.landing_campus,
          landing_quotes: form.landing_quotes,
          landing_gallery: form.landing_gallery,
          landing_section_titles: form.landing_section_titles,
          public_catalog: form.public_catalog,
          featured_course_ids: form.featured_course_ids,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success('Marketing settings saved')
      setPreviewKey((key) => key + 1)
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
  const previewId = getYoutubeId(form.hero_video_url)
  const previewStart = parseSecondsInput(form.hero_video_start_seconds, { allowZero: true }) ?? 0
  const previewEnd = parseSecondsInput(form.hero_video_end_seconds, { allowZero: false })

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Website design</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Edit every public homepage block. Save before the preview updates.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Saved page preview</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shows the last saved homepage. Unsaved edits stay in the form until you save.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={previewFrame === 'phone' ? 'default' : 'outline'}
              onClick={() => setPreviewFrame('phone')}
            >
              Phone
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewFrame === 'desktop' ? 'default' : 'outline'}
              onClick={() => setPreviewFrame('desktop')}
            >
              Desktop
            </Button>
          </div>
        </div>
        <iframe
          key={previewKey}
          title="Homepage preview"
          src="/?preview=1"
          className={
            previewFrame === 'phone'
              ? 'mx-auto h-[720px] w-[390px] rounded-2xl border border-border bg-background'
              : 'h-[720px] w-full rounded-xl border border-border bg-background'
          }
        />
      </section>

      {/* Hero */}
      <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h3 className="text-sm font-semibold">Hero</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Headline and buttons sit beside the video on desktop. On a phone the video fills the frame behind the card. Clear the video URL to use an uploaded image instead.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero_video_url">YouTube video URL</Label>
          <Input
            id="hero_video_url"
            value={form.hero_video_url}
            onChange={(e) => setForm((f) => ({ ...f, hero_video_url: e.target.value }))}
            placeholder={DEFAULT_HERO_VIDEO_URL}
          />
          {previewId ? (
            <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-black">
              <YoutubeFrame
                key={`${previewId}-${previewStart}-${previewEnd ?? 'end'}`}
                id={previewId}
                title="Hero video preview"
                params={{
                  rel: 0,
                  modestbranding: 1,
                  start: previewStart,
                  end: previewEnd != null && previewEnd > previewStart ? previewEnd : undefined,
                }}
              />
            </div>
          ) : (
            <p className="text-xs text-destructive">Enter a valid YouTube URL to preview.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hero_video_start_seconds">Loop start (seconds)</Label>
            <Input
              id="hero_video_start_seconds"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form.hero_video_start_seconds}
              onChange={(e) => setForm((f) => ({ ...f, hero_video_start_seconds: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero_video_end_seconds">Loop end (seconds)</Label>
            <Input
              id="hero_video_end_seconds"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.hero_video_end_seconds}
              onChange={(e) => setForm((f) => ({ ...f, hero_video_end_seconds: e.target.value }))}
              placeholder="End of video"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Trim the background loop. Leave blank to use the full video. End must be greater than start.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="video_quality">Video quality</Label>
          <Select
            value={form.video_quality}
            onValueChange={(v) =>
              v &&
              setForm((f) => ({
                ...f,
                video_quality: v as VideoQualityPreference,
              }))
            }
          >
            <SelectTrigger id="video_quality" className="w-full sm:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_QUALITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {VIDEO_QUALITY_OPTIONS.find((o) => o.value === form.video_quality)?.hint}{' '}
            Prefers a higher YouTube rendition for the hero. Lesson uploads play the original MP4.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landing_headline">Headline</Label>
          <Input
            id="landing_headline"
            value={form.landing_headline}
            onChange={(e) => setForm((f) => ({ ...f, landing_headline: e.target.value }))}
            placeholder="Leave blank for typewriter headline"
          />
          <p className="text-[11px] text-muted-foreground">
            Blank uses “Advanced learning for …” with rotating words.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="landing_description">Supporting description</Label>
          <Textarea
            id="landing_description"
            rows={3}
            value={form.landing_description}
            onChange={(e) => setForm((f) => ({ ...f, landing_description: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero_rotating_words">Rotating words</Label>
          <Input
            id="hero_rotating_words"
            value={form.hero_rotating_words}
            onChange={(e) => setForm((f) => ({ ...f, hero_rotating_words: e.target.value }))}
            placeholder="Modern Bhutan, Every Learner, Future Leaders"
          />
          <p className="text-[11px] text-muted-foreground">Comma-separated.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero_cta_primary_label">Primary CTA label</Label>
          <Input
            id="hero_cta_primary_label"
            value={form.hero_cta_primary_label}
            onChange={(e) => setForm((f) => ({ ...f, hero_cta_primary_label: e.target.value }))}
            placeholder={DEFAULT_HERO_CTA_PRIMARY}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero_cta_secondary_label">Secondary button label</Label>
          <Input
            id="hero_cta_secondary_label"
            value={form.hero_cta_secondary_label}
            onChange={(e) => setForm((f) => ({ ...f, hero_cta_secondary_label: e.target.value }))}
            placeholder="Browse courses"
          />
          <p className="text-[11px] text-muted-foreground">
            Links to the course section when the public catalog is on. Hidden when the catalog is off.
          </p>
        </div>
        <ImageUrlField
          label="Hero image"
          hint="Used only when the YouTube URL is empty."
          value={form.hero_image_url}
          onChange={(url) => setForm((f) => ({ ...f, hero_image_url: url }))}
        />
        <div className="space-y-1.5">
          <Label htmlFor="hero_glass_opacity">Frosted card opacity ({form.hero_glass_opacity}%)</Label>
          <input
            id="hero_glass_opacity"
            type="range"
            min={20}
            max={90}
            step={1}
            value={form.hero_glass_opacity}
            onChange={(e) => setForm((f) => ({ ...f, hero_glass_opacity: Number(e.target.value) }))}
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            How solid the headline card looks over the video. Save before the preview updates.
          </p>
        </div>
      </section>

      {/* Stats */}
      <ListEditorSection
        title="Stats"
        hint="Value and label pills under the hero. Remove every row to hide the block. Use the arrows to reorder."
        onAdd={() =>
          setForm((f) => ({
            ...f,
            landing_stats: [...f.landing_stats, { value: '', label: '' }],
          }))
        }
      >
        {form.landing_stats.map((stat, i) => (
          <div key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-border/50 p-3">
            <Input
              className="min-w-[5rem] flex-1"
              placeholder="500+"
              value={stat.value}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_stats]
                  next[i] = { ...next[i], value: e.target.value }
                  return { ...f, landing_stats: next }
                })
              }
            />
            <Input
              className="min-w-[7rem] flex-1"
              placeholder="Learners"
              value={stat.label}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_stats]
                  next[i] = { ...next[i], label: e.target.value }
                  return { ...f, landing_stats: next }
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={i === 0}
              onClick={() =>
                setForm((f) => ({ ...f, landing_stats: moveItem(f.landing_stats, i, -1) }))
              }
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={i === form.landing_stats.length - 1}
              onClick={() =>
                setForm((f) => ({ ...f, landing_stats: moveItem(f.landing_stats, i, 1) }))
              }
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  landing_stats: f.landing_stats.filter((_, j) => j !== i),
                }))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </ListEditorSection>

      {/* Features */}
      <ListEditorSection
        title="Programs"
        hint="Colored tiles. Each button links to sign in. Remove every card to hide the block."
        onAdd={() =>
          setForm((f) => ({
            ...f,
            landing_features: [
              ...f.landing_features,
              { title: '', description: '', icon: 'Sparkles' },
            ],
          }))
        }
      >
        {form.landing_features.map((feat, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[10rem] flex-1"
                placeholder="Title"
                value={feat.title}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_features]
                    next[i] = { ...next[i], title: e.target.value }
                    return { ...f, landing_features: next }
                  })
                }
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={feat.icon}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_features]
                    next[i] = { ...next[i], icon: e.target.value }
                    return { ...f, landing_features: next }
                  })
                }
              >
                {LANDING_ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    landing_features: f.landing_features.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              rows={2}
              placeholder="Description"
              value={feat.description}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_features]
                  next[i] = { ...next[i], description: e.target.value }
                  return { ...f, landing_features: next }
                })
              }
            />
            <Input
              placeholder="Button label"
              value={feat.cta_label || ''}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_features]
                  next[i] = { ...next[i], cta_label: e.target.value }
                  return { ...f, landing_features: next }
                })
              }
            />
          </div>
        ))}
      </ListEditorSection>

      {/* Steps */}
      <ListEditorSection
        title="Journey"
        hint="Numbered path. Remove every step to hide the block."
        onAdd={() =>
          setForm((f) => ({
            ...f,
            landing_steps: [
              ...f.landing_steps,
              { title: '', description: '', icon: 'UserPlus' },
            ],
          }))
        }
      >
        {form.landing_steps.map((step, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-[10rem] flex-1"
                placeholder="Title"
                value={step.title}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_steps]
                    next[i] = { ...next[i], title: e.target.value }
                    return { ...f, landing_steps: next }
                  })
                }
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={step.icon}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_steps]
                    next[i] = { ...next[i], icon: e.target.value }
                    return { ...f, landing_steps: next }
                  })
                }
              >
                {LANDING_ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    landing_steps: f.landing_steps.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              rows={2}
              placeholder="Description"
              value={step.description}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_steps]
                  next[i] = { ...next[i], description: e.target.value }
                  return { ...f, landing_steps: next }
                })
              }
            />
          </div>
        ))}
      </ListEditorSection>

      {/* FAQ */}
      <ListEditorSection
        title="FAQ"
        hint="Questions shown on the homepage and used for rich results."
        onAdd={() =>
          setForm((f) => ({
            ...f,
            landing_faq: [...f.landing_faq, { question: '', answer: '' }],
          }))
        }
      >
        {form.landing_faq.map((item, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Question"
                value={item.question}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_faq]
                    next[i] = { ...next[i], question: e.target.value }
                    return { ...f, landing_faq: next }
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    landing_faq: f.landing_faq.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              rows={3}
              placeholder="Answer"
              value={item.answer}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_faq]
                  next[i] = { ...next[i], answer: e.target.value }
                  return { ...f, landing_faq: next }
                })
              }
            />
          </div>
        ))}
      </ListEditorSection>

      <ListEditorSection
        title="Campus spots"
        hint="Image cards. Hidden when none are saved."
        onAdd={() =>
          setForm((f) => ({
            ...f,
            landing_campus: [...f.landing_campus, { image_url: '', title: '', description: '' }],
          }))
        }
      >
        {form.landing_campus.map((card, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Title"
                value={card.title}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_campus]
                    next[i] = { ...next[i], title: e.target.value }
                    return { ...f, landing_campus: next }
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    landing_campus: f.landing_campus.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="Short line"
              value={card.description}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_campus]
                  next[i] = { ...next[i], description: e.target.value }
                  return { ...f, landing_campus: next }
                })
              }
            />
            <ImageUrlField
              label="Image"
              value={card.image_url}
              onChange={(url) =>
                setForm((f) => {
                  const next = [...f.landing_campus]
                  next[i] = { ...next[i], image_url: url }
                  return { ...f, landing_campus: next }
                })
              }
            />
          </div>
        ))}
      </ListEditorSection>

      <ListEditorSection
        title="Quotes"
        hint="Hidden when none are saved. Do not add sample people."
        onAdd={() =>
          setForm((f) => ({
            ...f,
            landing_quotes: [...f.landing_quotes, { quote: '', name: '', role: '', stars: 5 }],
          }))
        }
      >
        {form.landing_quotes.map((quote, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Name"
                value={quote.name}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_quotes]
                    next[i] = { ...next[i], name: e.target.value }
                    return { ...f, landing_quotes: next }
                  })
                }
              />
              <Input
                className="w-20"
                type="number"
                min={1}
                max={5}
                value={quote.stars}
                onChange={(e) =>
                  setForm((f) => {
                    const next = [...f.landing_quotes]
                    next[i] = { ...next[i], stars: Number(e.target.value) || 5 }
                    return { ...f, landing_quotes: next }
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    landing_quotes: f.landing_quotes.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="Role"
              value={quote.role}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_quotes]
                  next[i] = { ...next[i], role: e.target.value }
                  return { ...f, landing_quotes: next }
                })
              }
            />
            <Textarea
              rows={2}
              placeholder="Quote"
              value={quote.quote}
              onChange={(e) =>
                setForm((f) => {
                  const next = [...f.landing_quotes]
                  next[i] = { ...next[i], quote: e.target.value }
                  return { ...f, landing_quotes: next }
                })
              }
            />
          </div>
        ))}
      </ListEditorSection>

      <ListEditorSection
        title="Gallery"
        hint="Photos beside the join panel. Hidden when none are saved."
        onAdd={() =>
          setForm((f) => ({
            ...f,
            landing_gallery: [...f.landing_gallery, ''],
          }))
        }
      >
        {form.landing_gallery.map((url, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-border/50 p-3">
            <div className="min-w-0 flex-1">
              <ImageUrlField
                label={`Photo ${i + 1}`}
                value={url}
                onChange={(nextUrl) =>
                  setForm((f) => {
                    const next = [...f.landing_gallery]
                    next[i] = nextUrl
                    return { ...f, landing_gallery: next }
                  })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  landing_gallery: f.landing_gallery.filter((_, j) => j !== i),
                }))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </ListEditorSection>

      {/* Section titles */}
      <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h3 className="text-sm font-semibold">Section titles</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Optional overrides for eyebrows and headings. Leave blank for defaults.
          </p>
        </div>
        {(
          [
            ['features_eyebrow', 'Features eyebrow'],
            ['features_title', 'Features title'],
            ['features_subtitle', 'Features subtitle'],
            ['steps_eyebrow', 'Steps eyebrow'],
            ['steps_title', 'Steps title'],
            ['steps_subtitle', 'Steps subtitle'],
            ['faq_eyebrow', 'FAQ eyebrow'],
            ['faq_title', 'FAQ title'],
            ['cta_title', 'Final CTA title'],
            ['cta_subtitle', 'Final CTA subtitle'],
            ['stats_eyebrow', 'Stats eyebrow'],
            ['campus_title', 'Campus title'],
            ['quotes_title', 'Quotes title'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              value={form.landing_section_titles[key] || ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  landing_section_titles: {
                    ...f.landing_section_titles,
                    [key]: e.target.value,
                  },
                }))
              }
              placeholder={DEFAULT_LANDING_SECTION_TITLES[key] || ''}
            />
          </div>
        ))}
      </section>

      <section className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card p-5">
        <div>
          <h3 className="text-sm font-semibold">Public catalog highlights</h3>
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
          <h3 className="text-sm font-semibold">Featured courses</h3>
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

      <Button onClick={save} disabled={saving || !canEdit} className="h-10">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saving ? 'Saving…' : 'Save marketing settings'}
      </Button>
    </div>
  )
}

function ImageUrlField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder="https://"
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            disabled={uploading}
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setUploading(true)
              try {
                const uploaded = await uploadImageDirectToCloudinary(file, { folder: 'landing' })
                onChange(uploaded.url)
                toast.success('Image uploaded')
              } catch (error: any) {
                toast.error(error?.message || 'Upload failed')
              } finally {
                setUploading(false)
              }
            }}
          />
        </label>
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function ListEditorSection({
  title,
  hint,
  onAdd,
  children,
}: {
  title: string
  hint: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
