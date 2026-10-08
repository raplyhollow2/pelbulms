import Link from 'next/link'
import { cn } from '@/lib/utils'

const RATIO = {
  horizontal: 356 / 124,
  stacked: 190 / 208,
  mark: 1,
  wordmark: 214 / 102,
} as const

const SRC = {
  horizontal: {
    light: '/brand/logo/rigbu-logo-horizontal-light.svg',
    dark: '/brand/logo/rigbu-logo-horizontal-dark.svg',
  },
  stacked: {
    light: '/brand/logo/rigbu-logo-stacked-light.svg',
    dark: '/brand/logo/rigbu-logo-stacked-dark.svg',
  },
  mark: {
    light: '/brand/logo/rigbu-mark-light.svg',
    dark: '/brand/logo/rigbu-mark-dark.svg',
  },
  wordmark: {
    light: '/brand/logo/rigbu-wordmark-ink.svg',
    dark: '/brand/logo/rigbu-wordmark-white.svg',
  },
} as const

type LogoVariant = keyof typeof SRC

type BrandLogoProps = {
  variant?: LogoVariant
  theme?: 'light' | 'dark' | 'auto'
  height?: number
  href?: string
  className?: string
  /** Uploaded LMS logo. When set, replaces the built-in lockup. */
  src?: string | null
  /** On viewports under 400px, show the owl mark at the same height. */
  markBelow400?: boolean
}

function dimensions(variant: LogoVariant, height: number) {
  const width = Math.round(height * RATIO[variant])
  return { width, height }
}

function LogoImage({
  src,
  width,
  height,
  className,
  alt,
}: {
  src: string
  width: number
  height: number
  className?: string
  alt: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn('block shrink-0', className)}
      style={{ width, height }}
    />
  )
}

function ThemedLogo({
  variant,
  theme,
  height,
}: {
  variant: LogoVariant
  theme: 'light' | 'dark' | 'auto'
  height: number
}) {
  const { width, height: h } = dimensions(variant, height)
  const files = SRC[variant]
  if (theme === 'light') {
    return <LogoImage src={files.light} width={width} height={h} alt="Rigbu" />
  }
  if (theme === 'dark') {
    return <LogoImage src={files.dark} width={width} height={h} alt="Rigbu" />
  }
  return (
    <>
      <LogoImage src={files.light} width={width} height={h} alt="Rigbu" className="dark:hidden" />
      <LogoImage src={files.dark} width={width} height={h} alt="" className="hidden dark:block" />
    </>
  )
}

function CustomLogo({ src, height }: { src: string; height: number }) {
  return (
    <img
      src={src}
      alt="Rigbu"
      width={height}
      height={height}
      className="block shrink-0 object-contain"
      style={{ width: height, height }}
    />
  )
}

export function BrandLogo({
  variant = 'horizontal',
  theme = 'auto',
  height = 32,
  href,
  className,
  src,
  markBelow400 = false,
}: BrandLogoProps) {
  const customSrc = src?.trim() || ''
  const showCompactMark = markBelow400 && variant !== 'mark' && !customSrc

  const logo = (
    <span className={cn('inline-flex items-center', className)}>
      {customSrc ? (
        <CustomLogo src={customSrc} height={height} />
      ) : (
        <>
          <span className={cn('inline-flex', showCompactMark && 'max-[399px]:hidden')}>
            <ThemedLogo variant={variant} theme={theme} height={height} />
          </span>
          {showCompactMark ? (
            <span className="hidden max-[399px]:inline-flex">
              <ThemedLogo variant="mark" theme={theme} height={height} />
            </span>
          ) : null}
        </>
      )}
    </span>
  )

  if (!href) return logo

  return (
    <Link href={href} aria-label="Rigbu home" className="inline-flex min-w-0 items-center">
      {logo}
    </Link>
  )
}
