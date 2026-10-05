'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, UploadCloud, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ACTIVITY_CATEGORY_FILTERS,
  defaultActivityRequired,
  EMPATHY_MAP_FIELDS,
  filterActivityTypes,
  getActivityDef,
  newActivityId,
  parseWorksheetFieldLines,
  type ActivityCategory,
  type LessonActivity,
  type LessonActivityType,
  type ActivityDefinition,
} from '@/lib/lesson-activities'
import { QuizCreator } from '@/components/quiz/quiz-creator'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { ACTIVITY_MODULE_CAP } from '@/lib/capability-catalog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  lessonId: string
  onAdd: (activity: LessonActivity) => void | Promise<void>
}

type FormState = {
  title: string
  description: string
  url: string
  content: string
  dueDate: string
  maxGrade: string
  passGrade: string
  allowSubmissions: boolean
  choicesText: string
  fileUrl: string
  fileName: string
  fieldsText: string
  aiBrief: string
  promptsText: string
}

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  url: '',
  content: '',
  dueDate: '',
  maxGrade: '100',
  passGrade: '60',
  allowSubmissions: true,
  choicesText: '',
  fileUrl: '',
  fileName: '',
  fieldsText: '',
  aiBrief: '',
  promptsText: '',
})

export function AddLessonActivityModal({
  open,
  onOpenChange,
  courseId,
  lessonId,
  onAdd,
}: Props) {
  const { has } = useCapabilities()
  const [selected, setSelected] = useState<LessonActivityType | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [required, setRequired] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const def = useMemo(
    () => (selected ? getActivityDef(selected) : undefined),
    [selected]
  )

  const filtered = useMemo(
    () =>
      filterActivityTypes(category, search).filter((def) => {
        const cap = ACTIVITY_MODULE_CAP[def.type]
        return cap ? has(cap) : true
      }),
    [category, search, has]
  )

  useEffect(() => {
    if (!open) {
      setSelected(null)
      setForm(emptyForm())
      setRequired(true)
      setError('')
      setSaving(false)
      setUploading(false)
      setCategory('all')
      setSearch('')
    }
  }, [open])

  const show = (field: string) => Boolean(def?.fields.includes(field as any))

  const uploadFile = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('courseId', courseId)
      body.append('lessonId', lessonId)
      body.append('title', file.name)
      const res = await fetch('/api/courses/resources', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setForm((prev) => ({
        ...prev,
        fileUrl: data.resource?.url || '',
        fileName: data.resource?.title || file.name,
        title: prev.title || file.name.replace(/\.[^.]+$/, ''),
      }))
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!selected || !def) return
    setError('')
    const title = form.title.trim() || def.label
    if (show('url') && !form.url.trim() && !form.fileUrl && selected === 'url') {
      setError('Please enter a URL')
      return
    }
    if (show('file') && selected === 'file' && !form.fileUrl && !form.url.trim()) {
      setError('Upload a file or paste a file URL')
      return
    }
    if (selected === 'prompt' && !form.content.trim()) {
      setError('Write the prompt students will see')
      return
    }
    if (selected === 'worksheet' && parseWorksheetFieldLines(form.fieldsText).length === 0) {
      setError('Add at least one template field (one label per line)')
      return
    }
    if (show('choices')) {
      const choices = form.choicesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (choices.length < 2) {
        setError('Add at least two choice options (one per line)')
        return
      }
    }

    if (show('passGrade') && form.passGrade) {
      const pass = Number(form.passGrade)
      if (Number.isNaN(pass) || pass < 0) {
        setError(selected === 'quiz' ? 'Pass grade must be 0 or higher' : 'Grade to pass must be 0 or higher')
        return
      }
      if (show('maxGrade') && form.maxGrade && pass > Number(form.maxGrade)) {
        setError('Grade to pass cannot be higher than the maximum grade')
        return
      }
    }

    setSaving(true)
    try {
      const activity: LessonActivity = {
        id: newActivityId(),
        activity: selected,
        title,
        description: form.description.trim() || undefined,
        url: form.url.trim() || undefined,
        fileUrl: form.fileUrl || undefined,
        fileName: form.fileName || undefined,
        content: form.content.trim() || undefined,
        dueDate: form.dueDate || undefined,
        maxGrade: form.maxGrade ? Number(form.maxGrade) : undefined,
        passGrade: form.passGrade ? Number(form.passGrade) : undefined,
        allowSubmissions: show('allowSubmissions') ? form.allowSubmissions : undefined,
        choices: show('choices')
          ? form.choicesText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        fields: show('fields') ? parseWorksheetFieldLines(form.fieldsText) : undefined,
        aiBrief: show('aiBrief') ? form.aiBrief.trim() || undefined : undefined,
        prompts: show('promptList')
          ? form.promptsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 8)
          : undefined,
        required: def?.category === 'resources' ? false : required,
        createdAt: new Date().toISOString(),
      }
      await onAdd(activity)
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to add activity')
    } finally {
      setSaving(false)
    }
  }

  const TypeCard = ({ item }: { item: ActivityDefinition }) => {
    const Icon = item.icon
    const maturityLabel =
      item.maturity === 'working'
        ? 'Ready'
        : item.maturity === 'partial'
          ? 'Limited'
          : 'Coming soon'
    return (
      <Button
        type="button"
        onClick={() => {
          setSelected(item.type)
          const next = emptyForm()
          if (!item.fields.includes('passGrade')) next.passGrade = ''
          setForm(next)
          setRequired(defaultActivityRequired(item.type))
          setError('')
        }}
        className={cn(
          'flex min-w-0 flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5',
          selected === item.type && 'border-primary bg-primary/10'
        )}
      >
        <div className="flex w-full min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium leading-snug">{item.label}</p>
            <Badge
              variant="outline"
              className={cn(
                'mt-1 h-auto max-w-full whitespace-normal text-[10px] font-normal',
                item.maturity === 'working' && 'border-green-600/40 text-green-700',
                item.maturity === 'partial' && 'border-amber-600/40 text-amber-700',
                item.maturity === 'stub' && 'border-muted-foreground/30 text-muted-foreground'
              )}
            >
              {maturityLabel}
            </Badge>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
          </div>
        </div>
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {selected && def ? `Add ${def.label}` : 'Add an activity or resource'}
          </DialogTitle>
          <DialogDescription>
            {selected && def
              ? def.description
              : 'Choose a Moodle-style activity. Fields change based on what you pick.'}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="min-h-11 pl-9"
                aria-label="Search activities"
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <nav
                className="flex shrink-0 gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible"
                aria-label="Activity categories"
              >
                {ACTIVITY_CATEGORY_FILTERS.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    onClick={() => setCategory(f.id)}
                    className={cn(
                      'min-h-11 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors',
                      category === f.id
                        ? 'bg-primary/20 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    {f.label}
                  </Button>
                ))}
              </nav>

              <div className="min-w-0 flex-1">
                {filtered.length === 0 ? (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No activities match your search.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filtered.map((item) => (
                      <TypeCard key={item.type} item={item} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : selected === 'quiz' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 min-h-11"
            onClick={() => {
              setSelected(null)
              setError('')
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to types
          </Button>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 min-h-11"
              onClick={() => {
                setSelected(null)
                setError('')
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to types
            </Button>

            {def?.maturity === 'stub' ? (
              <p className="rounded-lg border border-amber-600/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Limited preview: this activity saves to the lesson and can be marked done, but
                Moodle-style interaction (branching lesson player, IMS/SCORM player, etc.) is not
                implemented yet.
              </p>
            ) : null}
            {def?.maturity === 'partial' && selected !== 'assignment' ? (
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Partial: metadata and links work for learners. Full grading, submissions, or
                embedded players may still be missing.
              </p>
            ) : null}

            {show('title') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-title">Name</Label>
                <Input
                  id="act-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={def?.label}
                />
              </div>
            )}

            {show('description') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-desc">Description</Label>
                <Textarea
                  id="act-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="What should students do?"
                />
              </div>
            )}

            {show('content') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-content">
                  {selected === 'book'
                    ? 'Chapters / content'
                    : selected === 'lesson'
                      ? 'Pages / branching outline'
                      : selected === 'prompt'
                        ? 'Prompt'
                        : 'Content'}
                </Label>
                <Textarea
                  id="act-content"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={6}
                  placeholder={
                    selected === 'book'
                      ? 'Chapter 1…\nChapter 2…'
                      : selected === 'lesson'
                        ? 'Page 1 → Question → Branch A / Branch B…'
                        : selected === 'prompt'
                          ? 'What skills will I gain from this course?'
                          : 'Write the page or text content…'
                  }
                />
              </div>
            )}

            {show('url') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-url">URL</Label>
                <Input
                  id="act-url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            )}

            {show('file') && (
              <div className="space-y-2">
                <Label>File</Label>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.zip,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadFile(file)
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4 mr-1.5" />
                    )}
                    {uploading ? 'Uploading…' : 'Upload file'}
                  </Button>
                  {form.fileName && (
                    <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                      {form.fileName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {show('dueDate') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-due">Due date</Label>
                <Input
                  id="act-due"
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            )}

            {show('maxGrade') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-max">Maximum grade</Label>
                <Input
                  id="act-max"
                  type="number"
                  min={0}
                  value={form.maxGrade}
                  onChange={(e) => setForm({ ...form, maxGrade: e.target.value })}
                />
              </div>
            )}

            {show('passGrade') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-pass">
                  {show('maxGrade') ? 'Grade to pass' : 'Pass grade (%)'}
                </Label>
                <Input
                  id="act-pass"
                  type="number"
                  min={0}
                  max={show('maxGrade') ? undefined : 100}
                  value={form.passGrade}
                  onChange={(e) => setForm({ ...form, passGrade: e.target.value })}
                  placeholder={show('maxGrade') ? 'Any recorded grade' : '60'}
                />
                {show('maxGrade') ? (
                  <p className="text-xs text-muted-foreground">
                    Minimum score required to pass. Used for activity completion, the next
                    lesson, and the certificate. Leave empty to accept any recorded grade.
                  </p>
                ) : null}
              </div>
            )}

            {show('allowSubmissions') && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="act-submit">Allow file submissions</Label>
                  <p className="text-xs text-muted-foreground">
                    Students can upload work for this assignment
                  </p>
                </div>
                <Switch
                  id="act-submit"
                  checked={form.allowSubmissions}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, allowSubmissions: checked })
                  }
                />
              </div>
            )}

            {show('fields') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="act-fields">Template fields (one per line)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        title: prev.title || 'Empathy map',
                        fieldsText: EMPATHY_MAP_FIELDS.map(
                          (field) => `${field.label} | ${field.placeholder || ''}`
                        ).join('\n'),
                        aiBrief:
                          prev.aiBrief ||
                          'Turn this empathy map into a one-page customer profile. Use only what the student wrote. Mark gaps instead of inventing facts.',
                      }))
                    }
                  >
                    Use empathy map
                  </Button>
                </div>
                <Textarea
                  id="act-fields"
                  value={form.fieldsText}
                  onChange={(e) => setForm({ ...form, fieldsText: e.target.value })}
                  rows={6}
                  placeholder={'Says | What they say out loud\nThinks | What they think'}
                />
                <p className="text-xs text-muted-foreground">
                  Label, then an optional placeholder after a pipe.
                </p>
              </div>
            )}

            {show('aiBrief') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-brief">How the assistant should use this</Label>
                <Textarea
                  id="act-brief"
                  value={form.aiBrief}
                  onChange={(e) => setForm({ ...form, aiBrief: e.target.value })}
                  rows={3}
                  placeholder="Turn these answers into a customer profile. Do not invent facts."
                />
              </div>
            )}

            {show('promptList') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-prompts">Assistant prompts (one per line)</Label>
                <Textarea
                  id="act-prompts"
                  value={form.promptsText}
                  onChange={(e) => setForm({ ...form, promptsText: e.target.value })}
                  rows={3}
                  placeholder={'Build a customer profile from my empathy map'}
                />
              </div>
            )}

            {show('choices') && (
              <div className="space-y-1.5">
                <Label htmlFor="act-choices">Options (one per line)</Label>
                <Textarea
                  id="act-choices"
                  value={form.choicesText}
                  onChange={(e) => setForm({ ...form, choicesText: e.target.value })}
                  rows={4}
                  placeholder={'Option A\nOption B\nOption C'}
                />
              </div>
            )}

            {def?.category !== 'resources' ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <Label htmlFor="act-required" className="text-sm">
                    Mandatory
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Learners must finish this before unlocking the next lesson (when gating is on)
                  </p>
                </div>
                <Switch
                  id="act-required"
                  checked={required}
                  onCheckedChange={setRequired}
                />
              </div>
            ) : null}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {selected === 'quiz' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <Label htmlFor="quiz-required" className="text-sm">
                  Mandatory
                </Label>
                <p className="text-xs text-muted-foreground">
                  Completes when the learner passes the quiz
                </p>
              </div>
              <Switch
                id="quiz-required"
                checked={required}
                onCheckedChange={setRequired}
              />
            </div>
            <QuizCreator
              lessonId={lessonId}
              compact
              onCancel={() => {
                setSelected(null)
                setError('')
              }}
              onSave={async (quiz) => {
                const activity: LessonActivity = {
                  id: newActivityId(),
                  activity: 'quiz',
                  title: quiz.title,
                  passGrade: quiz.passing_score,
                  quizId: quiz.id,
                  required,
                  createdAt: new Date().toISOString(),
                }
                await onAdd(activity)
                onOpenChange(false)
              }}
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {selected && selected !== 'quiz' && (
            <Button
              type="button"
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary"
              disabled={saving || uploading}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add to lesson
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
