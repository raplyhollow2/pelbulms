'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ExternalLink,
  Globe2,
  ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  Smile,
  Tag,
  ThumbsUp,
  Video,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getYoutubeId } from '@/lib/video-url'
import type { LinkPreview } from '@/lib/link-preview'

type Member = {
  id: string
  full_name: string
  avatar_url?: string | null
}

type Reply = {
  id: string
  thread_id: string
  body: string
  created_at: string
  author_name?: string
  author_avatar?: string | null
}

type Thread = {
  id: string
  title: string
  body: string
  created_at: string
  author_name?: string
  author_avatar?: string | null
  feeling?: string | null
  image_url?: string | null
  video_url?: string | null
  youtube_url?: string | null
  link_preview?: LinkPreview | null
  tagged_users?: Member[]
  replies?: Reply[]
}

interface LessonForumProps {
  courseId: string
  moduleId?: string
  lessonId?: string
  userId?: string
}

const FEELINGS = [
  '😊 happy',
  '🎉 celebrating',
  '🤔 thinking',
  '💡 inspired',
  '🙌 grateful',
  '🔥 fired up',
  '😅 confused',
  '📚 studying',
]

const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🔥', '🎉', '🤔', '👏', '💡', '🙌']
const URL_DETECT = /https?:\/\/[^\s<>"')\]]+/i

function initials(name?: string) {
  if (!name?.trim()) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

function PersonAvatar({
  name,
  src,
  size = 'default',
}: {
  name?: string
  src?: string | null
  size?: 'default' | 'sm' | 'lg'
}) {
  return (
    <Avatar size={size} className="bg-muted">
      {src ? <AvatarImage src={src} alt={name || 'User'} /> : null}
      <AvatarFallback className="bg-bhutan-yellow/20 text-xs font-semibold text-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function ToolbarIcon({
  label,
  color,
  children,
  onClick,
  disabled,
  active,
}: {
  label: string
  color: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
        color,
        active && 'bg-muted ring-1 ring-border'
      )}
    >
      {children}
    </button>
  )
}

function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  let host = preview.siteName || ''
  try {
    host = preview.siteName || new URL(preview.url).hostname.replace(/^www\./, '')
  } catch {
    /* ignore */
  }
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/30"
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.image} alt="" className="max-h-56 w-full object-cover" />
      ) : null}
      <div className="space-y-1 px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {host}
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {preview.title || preview.url}
        </p>
        {preview.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{preview.description}</p>
        ) : null}
        <p className="inline-flex items-center gap-1 text-[11px] text-[#0866FF]">
          Open link <ExternalLink className="h-3 w-3" />
        </p>
      </div>
    </a>
  )
}

function YoutubeEmbed({ url }: { url: string }) {
  const id = getYoutubeId(url)
  if (!id) return null
  return (
    <div className="aspect-video overflow-hidden rounded-xl border bg-black">
      <iframe
        title="YouTube video"
        src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

/**
 * Facebook-style discussion feed — course enrolled learners only.
 */
export function LessonForum({ courseId, moduleId, lessonId, userId }: LessonForumProps) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [threads, setThreads] = useState<Thread[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [composer, setComposer] = useState('')
  const [feeling, setFeeling] = useState<string | null>(null)
  const [feelingOpen, setFeelingOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [youtubeOpen, setYoutubeOpen] = useState(false)
  const [youtubeDraft, setYoutubeDraft] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [tagged, setTagged] = useState<Member[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [me, setMe] = useState<{ full_name?: string | null; avatar_url?: string | null } | null>(
    null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enrichedIds = useRef<Set<string>>(new Set())

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (lessonId) params.set('lessonId', lessonId)
    if (moduleId) params.set('moduleId', moduleId)
    const qs = params.toString()
    return `/api/courses/${courseId}/discussion${qs ? `?${qs}` : ''}`
  }, [courseId, lessonId, moduleId])

  useEffect(() => {
    void loadForum()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, userId])

  // Enrich older posts that have a URL but no stored preview yet
  useEffect(() => {
    const needs = threads.filter(
      (t) =>
        !t.link_preview &&
        !t.youtube_url &&
        URL_DETECT.test(t.body) &&
        !enrichedIds.current.has(t.id)
    )
    if (needs.length === 0) return
    let cancelled = false
    void (async () => {
      for (const thread of needs.slice(0, 5)) {
        enrichedIds.current.add(thread.id)
        const match = thread.body.match(URL_DETECT)
        const url = match?.[0]?.replace(/[.,;:!?)]+$/, '')
        if (!url || getYoutubeId(url)) continue
        try {
          const res = await fetch(
            `/api/courses/${courseId}/discussion/link-preview?url=${encodeURIComponent(url)}`,
            { credentials: 'include' }
          )
          const data = await res.json().catch(() => ({}))
          if (cancelled || !res.ok || !data.preview) continue
          setThreads((prev) =>
            prev.map((t) => (t.id === thread.id ? { ...t, link_preview: data.preview } : t))
          )
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [threads, courseId])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      if (videoPreview) URL.revokeObjectURL(videoPreview)
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [photoPreview, videoPreview])

  useEffect(() => {
    if (!composerOpen || !userId) return
    void (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/discussion/members`, {
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) setMembers(Array.isArray(data.members) ? data.members : [])
      } catch {
        /* ignore */
      }
    })()
  }, [composerOpen, courseId, userId])

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    const match = composer.match(URL_DETECT)
    if (!match?.[0]) {
      setLinkPreview(null)
      setPreviewLoading(false)
      return
    }
    const url = match[0].replace(/[.,;:!?)]+$/, '')
    if (getYoutubeId(url)) {
      setLinkPreview(null)
      if (!youtubeUrl) setYoutubeUrl(url)
      return
    }
    previewTimer.current = setTimeout(() => {
      void (async () => {
        setPreviewLoading(true)
        try {
          const res = await fetch(
            `/api/courses/${courseId}/discussion/link-preview?url=${encodeURIComponent(url)}`,
            { credentials: 'include' }
          )
          const data = await res.json().catch(() => ({}))
          if (res.ok && data.preview) setLinkPreview(data.preview)
          else setLinkPreview(null)
        } catch {
          setLinkPreview(null)
        } finally {
          setPreviewLoading(false)
        }
      })()
    }, 600)
  }, [composer, courseId, youtubeUrl])

  const loadForum = async () => {
    if (!userId) {
      setLoading(false)
      setEnabled(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(query, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load discussion')

      setEnabled(data.enabled !== false)
      setThreads(Array.isArray(data.threads) ? data.threads : [])
      setMe(data.me || null)
    } catch (e: any) {
      console.error('Forum load error:', e)
      const msg = String(e?.message || '')
      setError(
        msg === 'Failed to fetch' || msg.includes('NetworkError')
          ? 'Could not reach the server. Check your connection and try again.'
          : msg || 'Discussion is not available yet.'
      )
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }

  const resetComposer = () => {
    setComposer('')
    setFeeling(null)
    setFeelingOpen(false)
    setEmojiOpen(false)
    setTagOpen(false)
    setYoutubeOpen(false)
    setYoutubeDraft('')
    setYoutubeUrl(null)
    setTagged([])
    setMemberQuery('')
    setLinkPreview(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    if (videoPreview) URL.revokeObjectURL(videoPreview)
    setPhotoPreview(null)
    setPhotoFile(null)
    setVideoPreview(null)
    setVideoFile(null)
  }

  const createPost = async () => {
    const text = composer.trim()
    if (!userId || (!text && !photoFile && !videoFile && !youtubeUrl)) return
    setPosting(true)
    setError('')
    try {
      const form = new FormData()
      form.set('action', 'post')
      form.set('body', text)
      if (lessonId) form.set('lessonId', lessonId)
      if (moduleId) form.set('moduleId', moduleId)
      if (feeling) form.set('feeling', feeling)
      if (youtubeUrl) form.set('youtubeUrl', youtubeUrl)
      if (tagged.length) form.set('taggedUserIds', JSON.stringify(tagged.map((t) => t.id)))
      if (photoFile) form.set('file', photoFile)
      if (videoFile) form.set('video', videoFile)

      const res = await fetch(`/api/courses/${courseId}/discussion`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to post')

      resetComposer()
      setComposerOpen(false)
      await loadForum()
    } catch (e: any) {
      const msg = String(e?.message || '')
      setError(
        msg === 'Failed to fetch' || msg.includes('NetworkError')
          ? 'Could not reach the server. Check your connection and try again.'
          : msg || 'Failed to post'
      )
    } finally {
      setPosting(false)
    }
  }

  const postReply = async (threadId: string) => {
    const text = replyDrafts[threadId]?.trim()
    if (!userId || !text) return
    setPosting(true)
    setError('')
    try {
      const res = await fetch(`/api/courses/${courseId}/discussion`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          threadId,
          body: text,
          lessonId,
          moduleId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to comment')

      setReplyDrafts((prev) => ({ ...prev, [threadId]: '' }))
      setOpenComments((prev) => ({ ...prev, [threadId]: true }))
      await loadForum()
    } catch (e: any) {
      setError(e?.message || 'Failed to comment')
    } finally {
      setPosting(false)
    }
  }

  const onPickPhoto = (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file')
      return
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const onPickVideo = (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Please choose a video file')
      return
    }
    if (file.size > 80 * 1024 * 1024) {
      setError('Video must be under 80MB')
      return
    }
    if (videoPreview) URL.revokeObjectURL(videoPreview)
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
    setYoutubeUrl(null)
  }

  const applyYoutube = () => {
    const url = youtubeDraft.trim()
    if (!getYoutubeId(url)) {
      setError('Enter a valid YouTube URL')
      return
    }
    setYoutubeUrl(url)
    setYoutubeOpen(false)
    setError('')
    if (!composer.includes(url)) {
      setComposer((prev) => (prev.trim() ? `${prev.trim()}\n${url}` : url))
    }
  }

  const toggleTag = (member: Member) => {
    setTagged((prev) =>
      prev.some((p) => p.id === member.id)
        ? prev.filter((p) => p.id !== member.id)
        : [...prev, member]
    )
  }

  const insertEmoji = (emoji: string) => {
    setComposer((prev) => `${prev}${emoji}`)
    setEmojiOpen(false)
    textareaRef.current?.focus()
  }

  const myName = me?.full_name || 'You'
  const firstName = myName.split(' ')[0] || 'there'
  const canPost = Boolean(composer.trim() || photoFile || videoFile || youtubeUrl)

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => m.full_name.toLowerCase().includes(q))
  }, [members, memberQuery])

  const emptyLabel = useMemo(
    () =>
      userId
        ? 'Be the first to share something with classmates in this course.'
        : 'Sign in to join the feed.',
    [userId]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading feed…
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {error ||
            (userId
              ? 'Discussion is only available to enrolled learners for this course.'
              : 'Sign in to join the discussion.')}
        </p>
        {userId && (
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => void loadForum()}
          >
            Try again
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Visible only to learners enrolled in this course (and course staff).
      </p>

      <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
        <button
          type="button"
          disabled={!userId}
          onClick={() => setComposerOpen(true)}
          className="flex w-full items-center gap-3 text-left"
        >
          <PersonAvatar name={myName} src={me?.avatar_url} size="lg" />
          <div className="min-h-11 flex-1 rounded-full bg-muted/70 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted">
            {userId ? `What's on your mind, ${firstName}?` : 'Sign in to post…'}
          </div>
        </button>
        <div className="mt-3 grid grid-cols-3 gap-1 border-t pt-2">
          <button
            type="button"
            disabled={!userId}
            onClick={() => {
              setComposerOpen(true)
              setTimeout(() => fileInputRef.current?.click(), 50)
            }}
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 disabled:opacity-50"
          >
            <ImageIcon className="h-5 w-5 text-emerald-600" />
            Photo
          </button>
          <button
            type="button"
            disabled={!userId}
            onClick={() => {
              setComposerOpen(true)
              setYoutubeOpen(true)
            }}
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 disabled:opacity-50"
          >
            <Video className="h-5 w-5 text-rose-600" />
            Video
          </button>
          <button
            type="button"
            disabled={!userId}
            onClick={() => {
              setComposerOpen(true)
              setFeelingOpen(true)
            }}
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 disabled:opacity-50"
          >
            <Smile className="h-5 w-5 text-amber-500" />
            Feeling
          </button>
        </div>
      </div>

      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open)
          if (!open) {
            setFeelingOpen(false)
            setEmojiOpen(false)
            setTagOpen(false)
            setYoutubeOpen(false)
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-[520px]"
        >
          <DialogHeader className="relative border-b px-4 py-3 text-center">
            <DialogTitle className="text-center text-xl font-bold">Create post</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-2.5 right-3 rounded-full bg-muted"
              onClick={() => setComposerOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogHeader>

          <div className="space-y-3 px-4 pt-3 pb-4">
            <div className="flex items-start gap-3">
              <PersonAvatar name={myName} src={me?.avatar_url} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {myName}
                  {feeling ? (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      is feeling {feeling}
                    </span>
                  ) : null}
                  {tagged.length > 0 ? (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      with{' '}
                      {tagged.map((t) => t.full_name.split(' ')[0]).join(', ')}
                    </span>
                  ) : null}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    <Globe2 className="h-3 w-3" />
                    Class only
                  </span>
                </div>
              </div>
            </div>

            <Textarea
              ref={textareaRef}
              placeholder={`What's on your mind, ${firstName}? Paste a news link or YouTube URL…`}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              rows={5}
              disabled={posting}
              className="min-h-[120px] resize-none border-0 bg-transparent px-0 text-xl leading-snug shadow-none focus-visible:ring-0"
            />

            {emojiOpen && (
              <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-2">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-md text-lg hover:bg-muted"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {feelingOpen && (
              <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-2">
                {FEELINGS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setFeeling(f)
                      setFeelingOpen(false)
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {tagOpen && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-semibold">Tag classmates in this course</p>
                <Input
                  placeholder="Search enrolled learners…"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  className="h-10"
                />
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      No classmates found.
                    </p>
                  ) : (
                    filteredMembers.map((m) => {
                      const selected = tagged.some((t) => t.id === m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleTag(m)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted',
                            selected && 'bg-blue-50'
                          )}
                        >
                          <PersonAvatar name={m.full_name} src={m.avatar_url} size="sm" />
                          <span className="flex-1 truncate font-medium">{m.full_name}</span>
                          {selected ? (
                            <span className="text-xs font-semibold text-[#0866FF]">Tagged</span>
                          ) : null}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {youtubeOpen && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-semibold">Add a YouTube video</p>
                <Input
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={youtubeDraft}
                  onChange={(e) => setYoutubeDraft(e.target.value)}
                  className="h-10"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={applyYoutube}>
                    Add video
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    Upload video file
                  </Button>
                </div>
              </div>
            )}

            {previewLoading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading link preview…
              </p>
            )}
            {linkPreview && <LinkPreviewCard preview={linkPreview} />}
            {youtubeUrl && <YoutubeEmbed url={youtubeUrl} />}
            {photoPreview && (
              <div className="relative overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Upload preview" className="max-h-64 w-full object-cover" />
                <button
                  type="button"
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"
                  onClick={() => {
                    if (photoPreview) URL.revokeObjectURL(photoPreview)
                    setPhotoPreview(null)
                    setPhotoFile(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {videoPreview && (
              <div className="relative overflow-hidden rounded-xl border">
                <video src={videoPreview} controls className="max-h-64 w-full bg-black" />
                <button
                  type="button"
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"
                  onClick={() => {
                    if (videoPreview) URL.revokeObjectURL(videoPreview)
                    setVideoPreview(null)
                    setVideoFile(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm font-semibold">Add to your post</span>
              <div className="flex items-center gap-0.5">
                <ToolbarIcon
                  label="Photo"
                  color="text-emerald-600"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-5 w-5" />
                </ToolbarIcon>
                <ToolbarIcon
                  label="Tag people"
                  color="text-blue-600"
                  active={tagOpen || tagged.length > 0}
                  onClick={() => {
                    setFeelingOpen(false)
                    setYoutubeOpen(false)
                    setTagOpen((v) => !v)
                  }}
                >
                  <Tag className="h-5 w-5" />
                </ToolbarIcon>
                <ToolbarIcon
                  label="Feeling"
                  color="text-amber-500"
                  onClick={() => {
                    setTagOpen(false)
                    setYoutubeOpen(false)
                    setFeelingOpen((v) => !v)
                  }}
                >
                  <Smile className="h-5 w-5" />
                </ToolbarIcon>
                <ToolbarIcon
                  label="YouTube / Video"
                  color="text-rose-600"
                  active={youtubeOpen || Boolean(youtubeUrl || videoFile)}
                  onClick={() => {
                    setTagOpen(false)
                    setFeelingOpen(false)
                    setYoutubeOpen((v) => !v)
                  }}
                >
                  <Video className="h-5 w-5" />
                </ToolbarIcon>
                <ToolbarIcon
                  label="Emoji"
                  color="text-muted-foreground"
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <Smile className="h-5 w-5" />
                </ToolbarIcon>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => onPickVideo(e.target.files?.[0])}
            />

            <Button
              type="button"
              className={cn(
                'h-10 w-full text-sm font-semibold',
                canPost
                  ? 'bg-[#0866FF] text-white hover:bg-[#0759d9]'
                  : 'bg-muted text-muted-foreground'
              )}
              disabled={posting || !userId || !canPost}
              onClick={() => void createPost()}
            >
              {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        threads.map((thread) => {
          const comments = thread.replies || []
          const commentsOpen = openComments[thread.id] ?? comments.length > 0
          return (
            <article key={thread.id} className="rounded-xl border bg-card shadow-sm">
              <header className="flex items-start gap-3 px-4 pt-4">
                <PersonAvatar name={thread.author_name} src={thread.author_avatar} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {thread.author_name || 'Student'}
                    {thread.feeling ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        is feeling {thread.feeling}
                      </span>
                    ) : null}
                    {thread.tagged_users && thread.tagged_users.length > 0 ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        with{' '}
                        {thread.tagged_users.map((t) => t.full_name.split(' ')[0]).join(', ')}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(thread.created_at)}</p>
                </div>
              </header>

              <div className="space-y-3 px-4 py-3">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{thread.body}</p>
                {thread.youtube_url ? <YoutubeEmbed url={thread.youtube_url} /> : null}
                {thread.video_url ? (
                  <video
                    src={thread.video_url}
                    controls
                    className="max-h-[420px] w-full rounded-lg bg-black"
                  />
                ) : null}
                {thread.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thread.image_url}
                    alt=""
                    className="max-h-[420px] w-full rounded-lg object-cover"
                  />
                ) : null}
                {thread.link_preview ? <LinkPreviewCard preview={thread.link_preview} /> : null}
              </div>

              <div className="flex items-center justify-between border-t px-2 text-xs text-muted-foreground">
                <span className="px-2 py-2">
                  {comments.length === 0
                    ? 'No comments yet'
                    : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 border-t px-2 py-1">
                <button
                  type="button"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60"
                  onClick={() =>
                    setOpenComments((prev) => ({
                      ...prev,
                      [thread.id]: !(prev[thread.id] ?? comments.length > 0),
                    }))
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                  Comment
                </button>
                <button
                  type="button"
                  className="flex min-h-11 cursor-default items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground opacity-60"
                  disabled
                  title="Coming soon"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Like
                </button>
              </div>

              {commentsOpen && (
                <div className="space-y-3 border-t bg-muted/20 px-4 py-3">
                  {comments.map((r) => (
                    <div key={r.id} className="flex gap-2.5">
                      <PersonAvatar name={r.author_name} src={r.author_avatar} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl bg-muted/70 px-3 py-2">
                          <p className="text-xs font-semibold">{r.author_name || 'Student'}</p>
                          <p className="whitespace-pre-wrap text-sm">{r.body}</p>
                        </div>
                        <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                          {timeAgo(r.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {userId ? (
                    <div className="flex gap-2.5 pt-1">
                      <PersonAvatar name={myName} src={me?.avatar_url} size="sm" />
                      <div className="flex min-w-0 flex-1 items-end gap-2">
                        <Textarea
                          placeholder="Write a comment…"
                          value={replyDrafts[thread.id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [thread.id]: e.target.value }))
                          }
                          disabled={posting}
                          rows={1}
                          className="min-h-11 flex-1 resize-none rounded-full border-0 bg-muted/70 px-4 py-2.5 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              void postReply(thread.id)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-11 min-w-11 rounded-full"
                          disabled={posting || !(replyDrafts[thread.id] || '').trim()}
                          onClick={() => void postReply(thread.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}
