import Link from 'next/link'
import { ArrowRight, Star } from 'lucide-react'
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

const TILES = ['bg-teal-600', 'bg-sky-700', 'bg-bhutan-orange', 'bg-violet-600']

export function LandingStats({
  eyebrow,
  stats,
}: {
  eyebrow?: string
  stats: LandingStat[]
}) {
  if (!stats.length) return null
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
      {eyebrow ? (
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-bhutan-orange">
          {eyebrow}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={`${stat.value}-${stat.label}`} className="rounded-2xl border border-border/60 bg-card px-3 py-4 text-center shadow-sm">
            <dt className="text-2xl font-bold tracking-tight text-bhutan-orange">{stat.value}</dt>
            <dd className="mt-1 text-xs text-muted-foreground">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </section>
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
    <section id="features" className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-bhutan-orange">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => {
          const Icon = resolveLandingIcon(feature.icon)
          return (
            <article
              key={`${feature.title}-${index}`}
              className={`flex flex-col rounded-2xl p-5 text-white ${TILES[index % TILES.length]}`}
            >
              <Icon className="h-8 w-8" />
              <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/90">{feature.description}</p>
              <Button
                size="sm"
                className="mt-4 h-9 w-fit rounded-full bg-white font-semibold text-neutral-900 hover:bg-bhutan-yellow"
                render={<Link href="/auth/login" />}
              >
                {feature.cta_label || 'Learn more'}
              </Button>
            </article>
          )
        })}
      </div>
    </section>
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
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
        {cards.map((card) => {
          const image = resolveMediaUrl(card.image_url)
          return (
            <article key={card.title} className="w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 bg-card lg:w-auto">
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
    </section>
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
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-bhutan-orange">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-bhutan-yellow text-sm font-bold text-black">
              {index + 1}
            </span>
            <h3 className="mt-3 font-bold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function LandingQuotes({
  title,
  quotes,
}: {
  title: string
  quotes: LandingQuote[]
}) {
  if (!quotes.length) return null
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-5">
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {quotes.map((quote) => (
          <figure key={`${quote.name}-${quote.quote.slice(0, 24)}`} className="w-72 shrink-0 snap-start rounded-2xl border border-border/60 bg-card p-4 lg:w-auto">
            <div className="flex gap-0.5 text-bhutan-yellow">
              {Array.from({ length: quote.stars }).map((_, index) => (
                <Star key={index} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <blockquote className="mt-3 text-sm leading-relaxed">“{quote.quote}”</blockquote>
            <figcaption className="mt-4 text-sm font-semibold">
              {quote.name}
              {quote.role ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{quote.role}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

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
    <section className={`mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:px-5 ${photos.length ? 'lg:grid-cols-2' : ''}`}>
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
          className="mt-6 h-11 w-fit gap-2 rounded-full bg-bhutan-yellow px-5 font-bold text-black hover:bg-bhutan-orange"
          render={<Link href="/auth/login" />}
        >
          {buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}
