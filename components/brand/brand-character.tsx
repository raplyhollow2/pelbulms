import { cn } from '@/lib/utils'

const POSES = {
  hero: '/brand/character/rigbu-character-on-dark-512.png',
  hello: '/brand/character/rigbu-hello-512.png',
  thinking: '/brand/character/rigbu-thinking-512.png',
  celebrate: '/brand/character/rigbu-celebrate-512.png',
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
      className={cn('block h-auto w-full max-h-[240px] max-w-[240px] object-contain', className)}
    />
  )
}
