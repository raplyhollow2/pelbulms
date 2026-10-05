'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

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
  if (url && isVideoFile(url)) {
    return (
      <video
        aria-hidden
        className={cn('block w-auto object-contain', className || 'h-[4.35rem]')}
        autoPlay
        muted
        loop
        playsInline
        src={url}
      />
    )
  }
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={cn('block w-auto object-contain', className || 'h-[4.35rem]')} />
    )
  }
  return <RigbuMark className={className} />
}

function RigbuMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  const skin = `${id}-skin`
  const hair = `${id}-hair`
  const gho = `${id}-gho`
  const gold = `${id}-gold`
  const cover = `${id}-cover`

  return (
    <svg
      viewBox="4 6 80 86"
      role="img"
      aria-label="Rigbu"
      className={cn('w-auto overflow-visible', className || 'h-[4.35rem]')}
    >
      <defs>
        <radialGradient id={skin} cx="32%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#ffe0c2" />
          <stop offset="55%" stopColor="#f3b98a" />
          <stop offset="100%" stopColor="#e09a68" />
        </radialGradient>
        <linearGradient id={hair} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2e28" />
          <stop offset="100%" stopColor="#1a120e" />
        </linearGradient>
        <linearGradient id={gho} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f08a45" />
          <stop offset="50%" stopColor="#e06a28" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#e0a020" />
        </linearGradient>
        <linearGradient id={cover} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8a3d" />
          <stop offset="100%" stopColor="#d4480f" />
        </linearGradient>
      </defs>

      <g className="rigbu-bob">
        <path
          d="M28 54c1-8 8-12 18-12s17 4 18 12v30c0 4-6 7-12 7H40c-6 0-12-3-12-7V54z"
          fill={`url(#${gho})`}
        />
        <path d="M46 46.5v34" stroke="#b84312" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        <rect x="30" y="76" width="32" height="3.4" rx="1" fill={`url(#${gold})`} />

        <g className="rigbu-book">
          <rect x="54" y="60" width="22" height="16" rx="2" fill={`url(#${cover})`} />
          <rect x="55.4" y="61.4" width="9" height="13.2" rx="1" fill="#fff8ea" />
          <rect x="65.4" y="61.4" width="9.2" height="13.2" rx="1" fill="#fff1d4" />
          <path d="M64.6 61.4v13.2" stroke="#d4480f" strokeWidth="1" />
          <path d="M57 64.2h6M67.2 64.2h5.6M57 67.4h6M67.2 67.4h5" stroke="#e0b56a" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M70 58.2 71.2 61.2 74.2 62.4 71.2 63.6 70 66.6 68.8 63.6 65.8 62.4 68.8 61.2Z" fill={`url(#${gold})`} />
        </g>

        <circle cx="46" cy="36" r="18" fill={`url(#${skin})`} />
        <path d="M30 34c1-14 8-20 16-20s15 6 16 20c-4-6-10-9-16-9s-12 3-16 9z" fill={`url(#${hair})`} />
        <circle cx="34" cy="42" r="2.6" fill="#f3a090" opacity="0.85" />
        <circle cx="58" cy="42" r="2.6" fill="#f3a090" opacity="0.85" />

        <g className="rigbu-blink">
          <ellipse cx="39" cy="36" rx="3.3" ry="3.6" fill="#fff" />
          <ellipse cx="53" cy="36" rx="3.3" ry="3.6" fill="#fff" />
          <ellipse cx="39.3" cy="36.4" rx="1.9" ry="2.1" fill="#2a211c" />
          <ellipse cx="53.3" cy="36.4" rx="1.9" ry="2.1" fill="#2a211c" />
          <circle cx="38.6" cy="35.4" r="0.7" fill="#fff" />
          <circle cx="52.6" cy="35.4" r="0.7" fill="#fff" />
        </g>
        <path d="M39 44c2 2.6 12 2.6 14 0" fill="none" stroke="#c45c4c" strokeWidth="1.6" strokeLinecap="round" />

        <g className="rigbu-wave">
          <rect x="16" y="50" width="10" height="6" rx="2" fill="#fff9ec" transform="rotate(-18 21 53)" />
          <g transform="translate(14 40)">
            <ellipse cx="8" cy="10" rx="7" ry="5.2" fill={`url(#${skin})`} />
            <rect x="3.2" y="1.2" width="2.3" height="8" rx="1.1" fill={`url(#${skin})`} />
            <rect x="6" y="0" width="2.3" height="9" rx="1.1" fill={`url(#${skin})`} />
            <rect x="8.8" y="1" width="2.2" height="8.2" rx="1.1" fill={`url(#${skin})`} />
            <rect x="11.4" y="2.4" width="2" height="6.4" rx="1" fill={`url(#${skin})`} />
          </g>
        </g>
      </g>
    </svg>
  )
}
