import { cn } from '@/lib/utils'

const POSES = {
  default: '/brand/mascot/rigbu-owl-default.svg',
  hello: '/brand/mascot/rigbu-owl-hello.svg',
  thinking: '/brand/mascot/rigbu-owl-thinking.svg',
  celebrate: '/brand/mascot/rigbu-owl-celebrate.svg',
  oops: '/brand/mascot/rigbu-owl-oops.svg',
  sleepy: '/brand/mascot/rigbu-owl-sleepy.svg',
} as const

type BrandCharacterProps = {
  pose: keyof typeof POSES
  alt?: string
  className?: string
}

export function BrandCharacter({ pose, alt = '', className }: BrandCharacterProps) {
  return (
    <img
      src={POSES[pose]}
      alt={alt}
      width={240}
      height={240}
      loading="lazy"
      decoding="async"
      className={cn(
        'block h-auto w-full max-h-[240px] max-w-[240px] object-contain',
        pose === 'celebrate' && 'rigbu-celebrate-in',
        className,
      )}
    />
  )
}

export function RigbuLoader({ size = 80 }: { size?: number }) {
  const clamped = Math.min(96, Math.max(64, size))
  return (
    <img
      src="/rigbu-loader.svg"
      alt=""
      width={clamped}
      height={clamped}
      className="block shrink-0"
      style={{ width: clamped, height: clamped }}
    />
  )
}
