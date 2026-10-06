import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { cn } from '@/lib/utils'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: '800',
  display: 'swap',
})

const MARK = {
  light: '/brand/rigbu-mark-on-light.svg',
  dark: '/brand/rigbu-mark-on-dark.svg',
} as const

type BrandLogoProps = {
  variant?: 'full' | 'mark'
  theme?: 'light' | 'dark' | 'auto'
  size?: number
  href?: string
  className?: string
}

function MarkImage({
  src,
  size,
  className,
}: {
  src: string
  size: number
  className?: string
}) {
  return (
    <img
      src={src}
      alt="Rigbu"
      width={size}
      height={size}
      className={cn('block shrink-0', className)}
    />
  )
}

function Mark({ theme, size }: { theme: 'light' | 'dark' | 'auto'; size: number }) {
  if (theme === 'light') return <MarkImage src={MARK.light} size={size} />
  if (theme === 'dark') return <MarkImage src={MARK.dark} size={size} />
  return (
    <>
      <MarkImage src={MARK.light} size={size} className="dark:hidden" />
      <MarkImage src={MARK.dark} size={size} className="hidden dark:block" />
    </>
  )
}

export function BrandLogo({
  variant = 'full',
  theme = 'auto',
  size = 32,
  href,
  className,
}: BrandLogoProps) {
  const wordmarkColor = theme === 'dark' ? '#FAF7F2' : theme === 'light' ? '#1B2433' : undefined

  const logo = (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ gap: variant === 'full' ? size * 0.3 : undefined }}
    >
      <Mark theme={theme} size={size} />
      {variant === 'full' ? (
        <span
          aria-hidden
          className={cn(
            plusJakarta.className,
            'leading-none',
            theme === 'auto' && 'text-[#1B2433] dark:text-[#FAF7F2]',
          )}
          style={{
            fontSize: size * 0.9,
            letterSpacing: '-0.045em',
            fontWeight: 800,
            color: wordmarkColor,
          }}
        >
          rigbu
        </span>
      ) : null}
    </span>
  )

  if (!href) return logo

  return (
    <Link href={href} aria-label="Rigbu home" className="inline-flex min-w-0 items-center">
      {logo}
    </Link>
  )
}
