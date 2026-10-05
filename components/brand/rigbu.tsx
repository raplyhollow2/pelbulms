import { useId } from 'react'
import { cn } from '@/lib/utils'

type RigbuProps = {
  className?: string
  animated?: boolean
  title?: string
  bare?: boolean
}

export function Rigbu({ className, animated = false, title = 'Rigbu', bare = false }: RigbuProps) {
  const rawId = useId().replace(/:/g, '')
  const disc = `${rawId}-disc`
  const discClip = `${rawId}-disc-clip`
  const skin = `${rawId}-skin`
  const hair = `${rawId}-hair`
  const jacket = `${rawId}-jacket`
  const gold = `${rawId}-gold`
  const cover = `${rawId}-cover`
  const page = `${rawId}-page`
  const headClip = `${rawId}-head`

  return (
    <svg
      viewBox={bare ? '10 6 62 66' : '0 0 80 80'}
      role="img"
      aria-label={title}
      className={cn('shrink-0 overflow-visible', className)}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={disc} cx="36%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#fffdf8" />
          <stop offset="68%" stopColor="#fff3e0" />
          <stop offset="100%" stopColor="#e4ccaa" />
        </radialGradient>
        <radialGradient id={skin} cx="32%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#ffe7d0" />
          <stop offset="52%" stopColor="#f6c7a2" />
          <stop offset="100%" stopColor="#d3926c" />
        </radialGradient>
        <linearGradient id={hair} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#6a5144" />
          <stop offset="42%" stopColor="#3a2a22" />
          <stop offset="100%" stopColor="#1c120e" />
        </linearGradient>
        <linearGradient id={jacket} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#e8783a" />
          <stop offset="48%" stopColor="#c44716" />
          <stop offset="100%" stopColor="#8c2e0e" />
        </linearGradient>
        <linearGradient id={`${rawId}-skirt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d3541a" />
          <stop offset="100%" stopColor="#7a280c" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1b8" />
          <stop offset="45%" stopColor="#e8b423" />
          <stop offset="100%" stopColor="#b67910" />
        </linearGradient>
        <linearGradient id={cover} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8a3d" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
        <linearGradient id={page} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="100%" stopColor="#f3e2bc" />
        </linearGradient>
        <clipPath id={discClip}>
          <circle cx="40" cy="40" r="38" />
        </clipPath>
        <clipPath id={headClip}>
          <circle cx="40" cy="36" r="16.6" />
        </clipPath>
      </defs>

      {bare ? null : (
        <>
          <circle cx="40" cy="40" r="38" fill={`url(#${disc})`} />
          <g clipPath={`url(#${discClip})`}>
            <ellipse cx="27" cy="22" rx="18" ry="11" fill="#fff" opacity="0.42" />
          </g>
          <circle cx="40" cy="40" r="37.2" fill="none" stroke="#fff" strokeWidth="1.1" opacity="0.72" />
          <circle cx="40" cy="40" r="38" fill="none" stroke="#b8895c" strokeWidth="0.8" opacity="0.45" />
        </>
      )}

      <g className={animated ? 'rigbu-bob' : undefined}>
        {bare ? null : <ellipse cx="40" cy="69" rx="14" ry="2.4" fill="#a57858" opacity="0.28" />}
        <path d="M24 46.5c1-4 7-7 16-7s15 3 16 7v20c0 2.2-4.2 3.6-8.2 3.6H32.2c-4 0-8.2-1.4-8.2-3.6v-20z" fill={`url(#${jacket})`} />
        <path d="M40 42.8v22" stroke="#9a3412" strokeWidth="1.15" strokeLinecap="round" opacity="0.35" />
        <path d="M25 57.2h30v3.1H25z" fill={`url(#${gold})`} />
        <path d="M28.2 58.2h3.4M34.4 58.2h3.4M40.6 58.2h3.4M46.8 58.2h3.2" stroke="#8a5a10" strokeWidth="0.65" strokeLinecap="round" />
        <rect x="15.2" y="50.6" width="7.2" height="3.4" rx="1.1" fill="#fff9ec" transform="rotate(-16 18.8 52.3)" />
        <g className={animated ? 'rigbu-book' : undefined}>
          <path d="M50.2 62.2h11.6l1.1 1.3h-12z" fill="#8a320e" />
          <rect x="49" y="51.5" width="14" height="11" rx="1.6" fill={`url(#${cover})`} />
          <rect x="49.9" y="52.5" width="5.6" height="9" rx="0.8" fill={`url(#${page})`} />
          <rect x="56.2" y="52.5" width="5.8" height="9" rx="0.8" fill="#fff6d8" />
          <path d="M55.6 52.5v9" stroke="#c2410c" strokeWidth="0.9" />
          <path d="M50.4 53.2h4.6M57 53.2h4.2" stroke="#e0b56a" strokeWidth="0.6" strokeLinecap="round" />
        </g>
        <circle cx="23.2" cy="38" r="4.1" fill={`url(#${skin})`} />
        <circle cx="56.8" cy="38" r="4.1" fill={`url(#${skin})`} />
        <circle cx="22.2" cy="36.8" r="1.3" fill="#fff" opacity="0.45" />
        <circle cx="55.8" cy="36.8" r="1.3" fill="#fff" opacity="0.45" />
        <g clipPath={`url(#${headClip})`}>
          <circle cx="40" cy="36" r="16.6" fill={`url(#${skin})`} />
          <ellipse cx="32" cy="30" rx="7" ry="5" fill="#fff" opacity="0.28" />
          <ellipse cx="40" cy="24" rx="17" ry="10" fill={`url(#${hair})`} />
          <path d="M26 28c2-7 8-11 14-11s12 4 14 11" fill={`url(#${hair})`} />
        </g>
        <circle cx="28.2" cy="42.2" r="2.5" fill="#f09a88" opacity="0.72" />
        <circle cx="51.8" cy="42.2" r="2.5" fill="#f09a88" opacity="0.72" />
        <g className={animated ? 'rigbu-blink' : undefined}>
          <ellipse cx="33" cy="36.5" rx="3.05" ry="3.35" fill="#fff" />
          <ellipse cx="47" cy="36.5" rx="3.05" ry="3.35" fill="#fff" />
          <ellipse cx="33.25" cy="36.8" rx="1.8" ry="2.05" fill="#2c221c" />
          <ellipse cx="47.25" cy="36.8" rx="1.8" ry="2.05" fill="#2c221c" />
          <circle cx="32.6" cy="35.9" r="0.72" fill="#fff" />
          <circle cx="46.6" cy="35.9" r="0.72" fill="#fff" />
          <circle cx="33.7" cy="37.3" r="0.28" fill="#fff" opacity="0.85" />
          <circle cx="47.7" cy="37.3" r="0.28" fill="#fff" opacity="0.85" />
        </g>
        <path
          d="M33.2 43.4c1.8 3.4 11.8 3.4 13.6 0"
          fill="none"
          stroke="#c45c4c"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <g className={animated ? 'rigbu-wave' : undefined}>
          <g transform="translate(16.6 50.8) rotate(-24)">
            <rect x="-5.1" y="-12.4" width="2.2" height="6.6" rx="1.1" fill={`url(#${skin})`} />
            <rect x="-2.55" y="-13.8" width="2.3" height="7.8" rx="1.15" fill={`url(#${skin})`} />
            <rect x="0.05" y="-13.1" width="2.2" height="7.1" rx="1.1" fill={`url(#${skin})`} />
            <rect x="2.5" y="-11.2" width="1.95" height="5.5" rx="0.95" fill={`url(#${skin})`} />
            <ellipse cx="-0.15" cy="-4.6" rx="4.85" ry="3.55" fill={`url(#${skin})`} />
            <ellipse cx="-4.15" cy="-3.15" rx="1.7" ry="2.55" fill={`url(#${skin})`} transform="rotate(-38 -4.15 -3.15)" />
            <ellipse cx="-1.3" cy="-6.2" rx="2.1" ry="1" fill="#fff" opacity="0.28" />
          </g>
        </g>
        {animated ? (
          <path
            className="rigbu-spark"
            d="M64 48.5 65.1 51.4 68 52.5 65.1 53.6 64 56.5 62.9 53.6 60 52.5 62.9 51.4Z"
            fill={`url(#${gold})`}
          />
        ) : null}
      </g>
    </svg>
  )
}

export function RigbuLoader({
  label = 'Loading…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 text-center', className)}
      role="status"
      aria-live="polite"
    >
      <Rigbu animated className="h-24 w-24" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
