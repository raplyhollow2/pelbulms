import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveLandingIcon } from '@/lib/landing-icons'
import { resolveMediaUrl } from '@/lib/media'
import type {
  LandingCampusCard,
  LandingFeature,
  LandingQuote,
  LandingStat,
  LandingStep,
} from '@/lib/landing-content'

import { LandingSection } from '@/components/landing/landing-section'

const TILES = [
  {
    surface: 'bg-primary text-primary-foreground',
    copy: 'text-primary-foreground/80',
    button: 'bg-background text-foreground hover:bg-background/90',
  },
  {
    surface: 'bg-foreground text-background',
    copy: 'text-background/90',
    button: 'bg-background text-foreground hover:bg-background/90',
  },
  {
    surface: 'bg-destructive text-white',
    copy: 'text-white/90',
    button: 'bg-background text-foreground hover:bg-background/90',
  },
  {
    surface: 'bg-secondary text-secondary-foreground',
    copy: 'text-secondary-foreground/80',
    button: 'bg-background text-foreground hover:bg-background/90',
  },
]

export function LandingStats({
  eyebrow,
  stats,
}: {
  eyebrow?: string
  stats: LandingStat[]
}) {
  if (!stats.length) return null
  return (
    <LandingSection>
      {eyebrow ? (
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={`${stat.value}-${stat.label}`} className="rounded-2xl border border-border/60 bg-card px-3 py-4 text-center shadow-sm">
            <dt className="text-2xl font-bold tracking-tight text-primary">{stat.value}</dt>
            <dd className="mt-1 text-xs text-muted-foreground">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  )
}

export function LandingPrograms({
  eyebrow,
  title,
  subtitle,
  features,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  features: LandingFeature[]
}) {
  if (!features.length) return null
  return (
    <LandingSection id="features">
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => {
          const Icon = resolveLandingIcon(feature.icon)
          const tile = TILES[index % TILES.length]
          return (
            <article
              key={`${feature.title}-${index}`}
              className={`flex min-w-0 flex-col rounded-2xl p-5 ${tile.surface}`}
            >
              <Icon className="h-8 w-8" />
              <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
              <p className={`mt-2 flex-1 text-sm leading-relaxed ${tile.copy}`}>{feature.description}</p>
              {feature.cta_label ? (
                <Button
                  size="sm"
                  className={`mt-4 h-9 w-fit rounded-full font-semibold ${tile.button}`}
                  render={<Link href="/auth/login" />}
                >
                  {feature.cta_label}
                </Button>
              ) : null}
            </article>
          )
        })}
      </div>
    </LandingSection>
  )
}

export function LandingCampus({
  title,
  cards,
}: {
  title: string
  cards: LandingCampusCard[]
}) {
  if (!cards.length) return null
  return (
    <LandingSection>
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-6 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
        {cards.map((card) => {
          const image = resolveMediaUrl(card.image_url)
          return (
            <article key={card.title} className="w-72 min-w-0 shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 bg-card lg:w-auto">
              <div className="aspect-video bg-neutral-200">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={card.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-4">
                <h3 className="font-bold">{card.title}</h3>
                {card.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </LandingSection>
  )
}

export function LandingJourney({
  eyebrow,
  title,
  subtitle,
  steps,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  steps: LandingStep[]
}) {
  if (!steps.length) return null
  return (
    <LandingSection>
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <ol className="mt-8 grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {index + 1}
            </span>
            <h3 className="mt-3 font-bold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </LandingSection>
  )
}

export { LandingQuotes } from '@/components/landing/landing-quotes'

export function LandingJoin({
  images,
  title,
  subtitle,
  buttonLabel,
}: {
  images: string[]
  title: string
  subtitle?: string
  buttonLabel: string
}) {
  const photos = images.map((url) => resolveMediaUrl(url)).filter((url): url is string => Boolean(url))
  return (
    <LandingSection>
      <div className={`grid min-w-0 gap-4 ${photos.length ? 'lg:grid-cols-2' : ''}`}>
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="aspect-video w-full rounded-xl object-cover" />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col justify-center rounded-3xl bg-[#12324d] px-6 py-10 text-white">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-3 text-sm leading-relaxed text-white/80">{subtitle}</p> : null}
        <Button
          size="lg"
          className="mt-6 h-11 w-fit gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground hover:bg-primary/90"
          render={<Link href="/auth/login" />}
        >
          {buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      </div>
    </LandingSection>
  )
}
