'use client'

import { useEffect, useRef } from 'react'
import {
  YOUTUBE_EMBED_ALLOW,
  YOUTUBE_IFRAME_CLASS,
  pinYoutubeIframe,
  youtubeEmbedSrc,
} from '@/lib/video-url'
import { cn } from '@/lib/utils'

export function YoutubeFrame({
  id,
  title = 'YouTube',
  className,
  params,
}: {
  id: string
  title?: string
  className?: string
  params?: Record<string, string | number | boolean | null | undefined>
}) {
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = ref.current
    if (!iframe) return
    return pinYoutubeIframe(iframe)
  }, [id])

  return (
    <iframe
      ref={ref}
      title={title}
      src={youtubeEmbedSrc(id, params)}
      className={cn(YOUTUBE_IFRAME_CLASS, className)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      referrerPolicy="strict-origin-when-cross-origin"
      allow={YOUTUBE_EMBED_ALLOW}
      allowFullScreen
    />
  )
}
