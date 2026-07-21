'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { UploadCloud, Trash2, Loader2, Paperclip } from 'lucide-react'

export type LessonResourceItem = {
  title?: string
  url?: string
  type?: string
  size?: number
}

type Props = {
  courseId: string
  lessonId: string
  resources: LessonResourceItem[]
  onChange: (next: LessonResourceItem[]) => void | Promise<void>
  compact?: boolean
}

export function LessonResourcesEditor({
  courseId,
  lessonId,
  resources,
  onChange,
  compact = false,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const list = Array.isArray(resources) ? resources : []
  const inputId = `lesson-resource-upload-${lessonId}`

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('courseId', courseId)
      body.append('lessonId', lessonId)
      body.append('title', file.name)
      const res = await fetch('/api/courses/resources', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      await onChange([...list, data.resource])
    } catch (err: any) {
      alert(err?.message || 'Failed to upload resource')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Files for students (PDF, PPT, docs)
        </Label>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
          No files yet. Upload a PDF, PowerPoint, or document.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((item, index) => (
            <div
              key={`${item.url || item.title}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{item.title || 'Resource'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.type || item.url}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(list.filter((_, i) => i !== index))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <input
        type="file"
        accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.xls,.xlsx,application/pdf"
        className="hidden"
        id={inputId}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) await upload(file)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant={compact ? 'outline' : 'default'}
        size="sm"
        className={
          compact
            ? 'gap-1.5'
            : 'gap-1.5 bg-bhutan-yellow hover:bg-bhutan-orange text-black'
        }
        disabled={uploading}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UploadCloud className="w-4 h-4" />
        )}
        {uploading ? 'Uploading…' : 'Upload PDF / PPT / document'}
      </Button>
    </div>
  )
}
