'use client'

import { useEffect, useState } from 'react'
import { Copy, Mail, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { courseDescriptionPlain } from '@/lib/course-description'
import { cn } from '@/lib/utils'

export type CourseShareFields = {
  courseId: string
  title: string
  description?: string | null
  /** Draft courses can be copied, but social and device share stay off. */
  published?: boolean
}

export function courseShareUrl(courseId: string) {
  if (typeof window === 'undefined') return `/courses/${courseId}`
  return `${window.location.origin}/courses/${courseId}`
}

function shareBrief(description?: string | null) {
  const plain = courseDescriptionPlain(description)
  if (plain.length <= 180) return plain
  return `${plain.slice(0, 177).trimEnd()}…`
}

export function courseShareText(input: { title: string; description?: string | null; url: string }) {
  const title = input.title.trim() || 'Course'
  return [title, shareBrief(input.description), input.url].filter(Boolean).join('\n')
}

function ShareLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled?: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="inline-flex min-h-11 cursor-not-allowed items-center rounded-md border px-3 text-sm opacity-50">
        {children}
      </span>
    )
  }
  return (
    <a
      className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm hover:bg-muted"
      href={href}
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel={href.startsWith('mailto:') ? undefined : 'noreferrer'}
    >
      {children}
    </a>
  )
}

export function CourseSharePanel({
  courseId,
  title,
  description,
  published = true,
}: CourseShareFields) {
  const [canNativeShare, setCanNativeShare] = useState(false)
  const url = courseShareUrl(courseId)
  const courseTitle = title.trim() || 'Course'
  const brief = shareBrief(description)
  const message = courseShareText({ title: courseTitle, description, url })
  const locked = published === false

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === 'function')
  }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Course link copied')
    } catch {
      toast.error('Could not copy the course link')
    }
  }

  const nativeShare = async () => {
    if (locked || typeof navigator.share !== 'function') return
    try {
      await navigator.share({
        title: courseTitle,
        text: brief || courseTitle,
        url,
      })
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return
      toast.error('Could not open the share sheet')
    }
  }

  const encodedMessage = encodeURIComponent(message)
  const encodedUrl = encodeURIComponent(url)

  return (
    <div className="space-y-3">
      {locked ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Learners cannot open this until you publish it.
        </p>
      ) : null}
      <p className="break-all rounded-md border p-2 text-sm">{url}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyLink()}>
          <Copy />
          Copy link
        </Button>
        {canNativeShare ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={locked}
            onClick={() => void nativeShare()}
          >
            <Share2 />
            Share
          </Button>
        ) : null}
        <ShareLink href={`https://wa.me/?text=${encodedMessage}`} disabled={locked}>
          WhatsApp
        </ShareLink>
        <ShareLink
          href={`mailto:?subject=${encodeURIComponent(courseTitle)}&body=${encodedMessage}`}
          disabled={locked}
        >
          <Mail className="mr-1.5 size-4" />
          Email
        </ShareLink>
        <ShareLink
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          disabled={locked}
        >
          Facebook
        </ShareLink>
        <ShareLink
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          disabled={locked}
        >
          LinkedIn
        </ShareLink>
      </div>
    </div>
  )
}

export function CourseShareDialog({
  open,
  onOpenChange,
  courseId,
  title,
  description,
  published = true,
}: CourseShareFields & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share course</DialogTitle>
          <DialogDescription>
            {title.trim() ? `Send “${title.trim()}” with a link to the course page.` : 'Send a link to this course page.'}
          </DialogDescription>
        </DialogHeader>
        <CourseSharePanel
          courseId={courseId}
          title={title}
          description={description}
          published={published}
        />
      </DialogContent>
    </Dialog>
  )
}

export function CourseShareButton({
  courseId,
  title,
  description,
  published = true,
  className,
  appearance = 'icon',
}: CourseShareFields & {
  className?: string
  appearance?: 'icon' | 'button'
}) {
  const [open, setOpen] = useState(false)
  const label = `Share ${title.trim() || 'course'}`

  return (
    <>
      <Button
        type="button"
        variant={appearance === 'icon' ? 'secondary' : 'outline'}
        size={appearance === 'icon' ? 'icon-sm' : 'sm'}
        className={cn(appearance === 'icon' && 'rounded-full bg-background/90 shadow-sm backdrop-blur', className)}
        aria-label={label}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <Share2 />
        {appearance === 'button' ? 'Share' : null}
      </Button>
      <CourseShareDialog
        open={open}
        onOpenChange={setOpen}
        courseId={courseId}
        title={title}
        description={description}
        published={published}
      />
    </>
  )
}
