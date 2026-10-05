'use client'

import { cn } from '@/lib/utils'

const FOX = '/brand/rigbu-fox.png'

function isVideoFile(url: string) {
  return /\.(mp4|webm)(\?|#|$)/i.test(url) || /\/video\/upload\//.test(url) || /[?&]type=video\b/.test(url)
}

export function RigbuLive({
  src,
  className,
}: {
  src?: string | null
  className?: string
}) {
  const url = src?.trim() || ''
  const frame = cn('block w-auto object-contain', className || 'h-[4.35rem]')
  if (url && isVideoFile(url)) {
    return (
      <video
        aria-hidden
        className={frame}
        autoPlay
        muted
        loop
        playsInline
        src={url}
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url || FOX} alt="" className={frame} />
  )
}
