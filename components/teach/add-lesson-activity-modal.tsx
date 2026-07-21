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
import { Loader2, ArrowLeft, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LESSON_ACTIVITY_TYPES,
  getActivityDef,
  newActivityId,
  type LessonActivity,
  type LessonActivityType,
  type ActivityDefinition,
} from '@/lib/lesson-activities'

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
})

export function AddLessonActivityModal({
  open,
  onOpenChange,
  courseId,
  lessonId,
  onAdd,
}: Props) {
  const [selected, setSelected] = useState<LessonActivityType | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const def = useMemo(
    () => (selected ? getActivityDef(selected) : undefined),
    [selected]
  )

  useEffect(() => {
    if (!open) {
      setSelected(null)
      setForm(emptyForm())
      setError('')
      setSaving(false)
      setUploading(false)
    }
  }, [open])

  const activities = LESSON_ACTIVITY_TYPES.filter((a) => a.category === 'activities')
  const resources = LESSON_ACTIVITY_TYPES.filter((a) => a.category === 'resources')

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
    return (
      <button
        type="button"
        onClick={() => {
          setSelected(item.type)
          setForm(emptyForm())
          setError('')
        }}
        className={cn(
          'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:border-bhutan-yellow/60 hover:bg-bhutan-yellow/5',
          selected === item.type && 'border-bhutan-yellow bg-bhutan-yellow/10'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-bhutan-yellow" />
          </span>
          <span className="text-sm font-semibold">{item.label}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary">Activities</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {activities.map((item) => (
                  <TypeCard key={item.type} item={item} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline">Resources</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {resources.map((item) => (
                  <TypeCard key={item.type} item={item} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => {
                setSelected(null)
                setError('')
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to types
            </Button>

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
                  {selected === 'book' ? 'Chapters / content' : 'Content'}
                </Label>
                <Textarea
                  id="act-content"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={6}
                  placeholder={
                    selected === 'book'
                      ? 'Chapter 1…\nChapter 2…'
                      : 'Write the page or label content…'
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
                <Label htmlFor="act-pass">Pass grade (%)</Label>
                <Input
                  id="act-pass"
                  type="number"
                  min={0}
                  max={100}
                  value={form.passGrade}
                  onChange={(e) => setForm({ ...form, passGrade: e.target.value })}
                />
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

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {selected && (
            <Button
              type="button"
              className="bg-bhutan-yellow hover:bg-bhutan-orange text-black"
              disabled={saving || uploading}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Add to lesson
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
