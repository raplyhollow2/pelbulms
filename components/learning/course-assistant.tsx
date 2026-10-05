'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Copy, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { parseLessonActivities } from '@/lib/lesson-activities'
import type { AssistantTask } from '@/lib/ai/course-assistant'
import { cn } from '@/lib/utils'

type AssistantLesson = {
  id: string
  title?: string | null
  resources?: unknown
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type SavedPrompt = {
  id: string
  text: string
}

type Artifact = {
  id: string
  title: string
  kind: 'summary' | 'document'
  body_markdown: string
}

type Chip = {
  id: string
  label: string
  task: AssistantTask
  activityId?: string
  savedPromptId?: string
}

export function CourseAssistant({
  courseId,
  lessonId,
  tutorName = 'Course tutor',
  starterPrompts = [],
  lessons,
  className,
}: {
  courseId: string
  lessonId: string
  tutorName?: string
  starterPrompts?: string[]
  lessons: AssistantLesson[]
  className?: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [draft, setDraft] = useState('')
  const [armed, setArmed] = useState<Chip | null>(null)
  const [threadCourseId, setThreadCourseId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [error, setError] = useState('')
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const loadingThread = threadCourseId !== courseId

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/ai/assistant?courseId=${encodeURIComponent(courseId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Could not load the assistant')
        return data
      })
      .then((data) => {
        if (cancelled) return
        setMessages(Array.isArray(data.messages) ? data.messages : [])
        setSavedPrompts(Array.isArray(data.savedPrompts) ? data.savedPrompts : [])
        setArtifacts(Array.isArray(data.artifacts) ? data.artifacts : [])
        setError('')
        setThreadCourseId(courseId)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not load the assistant')
        setThreadCourseId(courseId)
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, sending, openArtifactId])

  const chips = useMemo(() => buildChips(lessonId, lessons, starterPrompts, savedPrompts), [
    lessonId,
    lessons,
    starterPrompts,
    savedPrompts,
  ])

  const openArtifact = artifacts.find((item) => item.id === openArtifactId) || null

  const applyChip = (chip: Chip) => {
    setDraft(chip.label)
    setArmed(chip)
    setError('')
  }

  const send = async () => {
    const question = draft.trim()
    if (!question || sending) return
    const task = armed && question === armed.label ? armed.task : 'chat'
    const activityId = task === 'worksheet' ? armed?.activityId : undefined
    const tempId = `pending-${Date.now()}`
    setSending(true)
    setError('')
    setDraft('')
    setArmed(null)
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: question }])
    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId,
          question,
          task,
          activityId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'The assistant could not answer')
      setMessages((prev) => [
        ...prev.filter((item) => item.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ].filter(Boolean))
      if (data.artifact?.id) {
        setArtifacts((prev) => [data.artifact, ...prev.filter((item) => item.id !== data.artifact.id)])
        setOpenArtifactId(data.artifact.id)
      }
    } catch (e: unknown) {
      setMessages((prev) => prev.filter((item) => item.id !== tempId))
      setDraft(question)
      setError(e instanceof Error ? e.message : 'The assistant could not answer')
    } finally {
      setSending(false)
    }
  }

  const savePrompt = async () => {
    const text = draft.trim()
    if (!text || savingPrompt) return
    setSavingPrompt(true)
    setError('')
    try {
      const res = await fetch('/api/ai/assistant/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save that prompt')
      if (data.prompt?.id) {
        setSavedPrompts((prev) => {
          if (prev.some((item) => item.id === data.prompt.id)) return prev
          return [data.prompt, ...prev]
        })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save that prompt')
    } finally {
      setSavingPrompt(false)
    }
  }

  const removePrompt = async (id: string) => {
    setError('')
    try {
      const res = await fetch(`/api/ai/assistant/prompts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not remove that prompt')
      setSavedPrompts((prev) => prev.filter((item) => item.id !== id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not remove that prompt')
    }
  }

  const copyArtifact = async () => {
    if (!openArtifact) return
    try {
      await navigator.clipboard.writeText(openArtifact.body_markdown)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Could not copy that document')
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col bg-background', className)}>
      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <h2 className="text-base font-semibold leading-snug">
            Do you have any questions about this course?
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {tutorName} can make mistakes. Check important answers against the lesson.
          </p>
        </div>

        {chips.length > 0 && !loadingThread && messages.length === 0 ? (
          <div className="space-y-2">
            {chips.map((chip) => (
              <div key={chip.id} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => applyChip(chip)}
                  className="min-h-11 flex-1 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/60"
                >
                  {chip.label}
                </button>
                {chip.savedPromptId ? (
                  <button
                    type="button"
                    aria-label="Remove saved prompt"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted/60"
                    onClick={() => void removePrompt(chip.savedPromptId!)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {artifacts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold">Your documents</p>
            <div className="flex flex-wrap gap-1.5">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  type="button"
                  onClick={() =>
                    setOpenArtifactId((current) => (current === artifact.id ? null : artifact.id))
                  }
                  className={cn(
                    'min-h-11 rounded-full border px-3 text-left text-xs hover:bg-muted/60',
                    openArtifactId === artifact.id && 'border-foreground bg-muted'
                  )}
                >
                  {artifact.title}
                </button>
              ))}
            </div>
            {openArtifact ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{openArtifact.title}</p>
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void copyArtifact()}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{openArtifact.body_markdown}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {loadingThread ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your conversation
          </div>
        ) : null}

        {!loadingThread
          ? messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed',
              message.role === 'user' ? 'ml-6 bg-muted' : 'mr-2 border'
            )}
          >
            {message.content}
          </div>
          ))
          : null}

        {sending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tutorName} is writing
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {!loadingThread && messages.length > 0 ? (
        <details className="border-t px-3 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">
            Prompts
          </summary>
          <div className="max-h-40 space-y-2 overflow-y-auto pb-2">
            {chips.map((chip) => (
              <div key={chip.id} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => applyChip(chip)}
                  className="min-h-11 flex-1 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/60"
                >
                  {chip.label}
                </button>
                {chip.savedPromptId ? (
                  <button
                    type="button"
                    aria-label="Remove saved prompt"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted/60"
                    onClick={() => void removePrompt(chip.savedPromptId!)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => {
              const next = event.target.value
              setDraft(next)
              if (armed && next.trim() !== armed.label) setArmed(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder="Ask a question"
            rows={2}
            className="min-h-11 flex-1 resize-none"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            className="min-h-11 min-w-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={sending || !draft.trim()}
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={savingPrompt || !draft.trim()}
          onClick={() => void savePrompt()}
        >
          {savingPrompt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Save this prompt
        </button>
      </form>
    </div>
  )
}

function buildChips(
  lessonId: string,
  lessons: AssistantLesson[],
  starterPrompts: string[],
  savedPrompts: SavedPrompt[]
): Chip[] {
  const chips: Chip[] = [
    {
      id: 'recap',
      label: 'Can you give me a recap of the previous lecture?',
      task: 'recap_previous',
    },
    { id: 'lesson', label: 'Summarize this lesson', task: 'summarize_lesson' },
    { id: 'notes', label: 'Summarize my notes', task: 'summarize_notes' },
    { id: 'document', label: 'Build a document from my saved work', task: 'document' },
  ]

  starterPrompts.forEach((text, index) => {
    const label = text.trim()
    if (!label) return
    chips.push({ id: `starter-${index}`, label, task: 'chat' })
  })

  const lesson = lessons.find((item) => item.id === lessonId)
  for (const activity of parseLessonActivities(lesson?.resources)) {
    if (activity.activity === 'prompt' && activity.content?.trim()) {
      chips.push({
        id: `prompt-${activity.id}`,
        label: activity.content.trim(),
        task: 'chat',
      })
    }
  }

  savedPrompts.forEach((prompt) => {
    chips.push({
      id: `saved-${prompt.id}`,
      label: prompt.text,
      task: 'chat',
      savedPromptId: prompt.id,
    })
  })

  for (const activity of parseLessonActivities(lesson?.resources)) {
    if (activity.activity !== 'worksheet') continue
    const prompts = (activity.prompts || []).map((item) => item.trim()).filter(Boolean)
    const labels = prompts.length ? prompts : [`Build from my ${activity.title}`]
    labels.forEach((label, index) => {
      chips.push({
        id: `worksheet-${activity.id}-${index}`,
        label,
        task: 'worksheet',
        activityId: activity.id,
      })
    })
  }

  return chips
}
