import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingHero, LandingStatsStrip } from '@/components/landing/landing-hero'
import { getPlatformSettings } from '@/lib/platform-settings'
import { tryCreateServiceClient, createSupabaseServerClient } from '@/lib/supabase/server'
import {
  DEFAULT_LANDING_FAQ,
  DEFAULT_LANDING_FEATURES,
  DEFAULT_LANDING_SECTION_TITLES,
  DEFAULT_LANDING_STEPS,
  DEFAULT_LANDING_STEPS_NO_KYC,
  type LandingFaqItem,
  type LandingFeature,
  type LandingStep,
} from '@/lib/landing-content'
import { resolveLandingIcon } from '@/lib/landing-icons'
import { resolveMediaUrl } from '@/lib/media'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pelbu.bt'
const FALLBACK_NAME = 'Pelbu LMS'
const FALLBACK_DESCRIPTION =
  'Pelbu LMS is Bhutan’s private, identity-verified learning platform. Students and teachers get world-class courses, progress tracking, private video lessons and recognised certificates — access granted only after Bhutan KYC approval.'

const FEATURE_TINTS = [
  'text-bhutan-orange bg-bhutan-orange/10',
  'text-bhutan-yellow bg-bhutan-yellow/15',
  'text-green-600 bg-green-600/10',
  'text-bhutan-red bg-bhutan-red/10',
  'text-blue-600 bg-blue-600/10',
  'text-purple-600 bg-purple-600/10',
]

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings()
  const siteName = settings.site_name || FALLBACK_NAME
  const description =
    settings.landing_description ||
    settings.tagline ||
    (settings.require_identity_documents
      ? FALLBACK_DESCRIPTION
      : `${siteName} is Bhutan’s learning platform for students, teachers and institutions.`)

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${siteName} — Bhutan’s Private Learning Platform`,
      template: `%s · ${siteName}`,
    },
    description,
    applicationName: siteName,
    keywords: [
      'Bhutan LMS',
      'learning management system Bhutan',
      'online courses Bhutan',
      'Pelbu',
      'Pelsung',
      'Dessung',
      'Gelephu Mindfulness City education',
      'private video courses',
      'digital certificates Bhutan',
      'e-learning Bhutan',
    ],
    authors: [{ name: 'Pelbu' }],
    creator: 'Pelbu',
    publisher: 'Pelbu',
    alternates: { canonical: '/' },
    category: 'education',
    openGraph: {
      type: 'website',
      locale: 'en_BT',
      url: SITE_URL,
      siteName,
      title: `${siteName} — Bhutan’s Private Learning Platform`,
      description,
      images: [{ url: '/icon.svg', width: 512, height: 512, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteName} — Bhutan’s Private Learning Platform`,
      description,
      images: ['/icon.svg'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  }
}

function jsonLd(siteName: string, description: string, faq: LandingFaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': `${SITE_URL}/#organization`,
        name: siteName,
        url: SITE_URL,
        description,
        areaServed: { '@type': 'Country', name: 'Bhutan' },
        logo: `${SITE_URL}/icon.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: siteName,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en',
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  }
}

async function loadFeaturedCourses(ids: string[]) {
  if (!ids.length) {
    return [] as {
      id: string
      title: string
      description: string | null
      thumbnail_url: string | null
    }[]
  }
  try {
    const service = await tryCreateServiceClient()
    const client = service || (await createSupabaseServerClient())
    const { data } = await client
      .from('courses')
      .select('id, title, description, thumbnail_url')
      .in('id', ids)
      .eq('is_published', true)
    const byId = new Map((data || []).map((c: any) => [c.id, c]))
    return ids.map((id) => byId.get(id)).filter(Boolean)
  } catch {
    return []
  }
}

function resolveFeatures(
  custom: LandingFeature[] | null,
  requireIdentity: boolean
): LandingFeature[] {
  if (custom?.length) return custom
  return DEFAULT_LANDING_FEATURES.map((f) =>
    f.title === 'Bhutan KYC access' && !requireIdentity
      ? {
          ...f,
          title: 'Trusted learner accounts',
          description:
            'Every learner registers with a real profile and institution so certificates stay trustworthy.',
        }
      : f
  )
}

function resolveSteps(custom: LandingStep[] | null, requireIdentity: boolean): LandingStep[] {
  if (custom?.length) return custom
  return requireIdentity ? DEFAULT_LANDING_STEPS : DEFAULT_LANDING_STEPS_NO_KYC
}

function resolveFaq(
  custom: LandingFaqItem[] | null,
  siteName: string,
  requireIdentity: boolean
): LandingFaqItem[] {
  if (custom?.length) {
    return custom.map((f) => ({
      question: f.question.replaceAll('Pelbu LMS', siteName).replaceAll('Pelbu', siteName),
      answer: f.answer.replaceAll('Pelbu LMS', siteName).replaceAll('Pelbu', siteName),
    }))
  }

  if (requireIdentity) {
    return DEFAULT_LANDING_FAQ.map((f) => ({
      question:
        f.question === 'What is Pelbu LMS?'
          ? `What is ${siteName}?`
          : f.question.replaceAll('Pelbu LMS', siteName).replaceAll('Pelbu', siteName),
      answer: f.answer.replaceAll('Pelbu LMS', siteName).replaceAll('Pelbu', siteName),
    }))
  }

  return [
    {
      question: `What is ${siteName}?`,
      answer: `${siteName} is Bhutan’s learning management platform. It offers private video courses, progress tracking and recognised certificates for students, teachers and institutions.`,
    },
    {
      question: `How do I get access to ${siteName}?`,
      answer:
        'Sign in with Google, complete a short profile (name, phone and institution), then request a course. Instructors and resource persons still need Superadmin approval. Course creators verify each enrollment.',
    },
    DEFAULT_LANDING_FAQ[3],
    DEFAULT_LANDING_FAQ[4],
  ]
}

export default async function Home() {
  const settings = await getPlatformSettings()
  const siteName = settings.site_name || FALLBACK_NAME
  const requireIdentity = settings.require_identity_documents
  const description =
    settings.landing_description ||
    (requireIdentity
      ? FALLBACK_DESCRIPTION
      : `${siteName} is Bhutan’s learning platform for students, teachers and institutions.`)
  const featured = settings.public_catalog
    ? await loadFeaturedCourses(settings.featured_course_ids)
    : []

  const titles = {
    ...DEFAULT_LANDING_SECTION_TITLES,
    ...settings.landing_section_titles,
  }

  const features = resolveFeatures(settings.landing_features, requireIdentity)
  const steps = resolveSteps(settings.landing_steps, requireIdentity)
  const faq = resolveFaq(settings.landing_faq, siteName, requireIdentity)

  const stepsTitle =
    titles.steps_title ||
    (requireIdentity ? 'Four steps to join Pelbu' : 'How to join')
  const stepsSubtitle =
    titles.steps_subtitle ||
    (requireIdentity
      ? 'Pelbu is a verified, closed network. Here’s exactly how access works.'
      : 'Create an account, pick your institution, then start requesting courses.')
  const ctaSubtitle =
    titles.cta_subtitle ||
    (requireIdentity
      ? 'Join a verified community of learners and educators. Get approved, then start your first course today.'
      : 'Join learners and educators across Bhutan. Create an account and start your first course today.')

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(siteName, description, faq)) }}
      />

      <main>
        <LandingHero
          siteName={siteName}
          tagline={settings.tagline}
          headline={settings.landing_headline}
          description={settings.landing_description || description}
          videoUrl={settings.hero_video_url}
          videoStartSeconds={settings.hero_video_start_seconds}
          videoEndSeconds={settings.hero_video_end_seconds}
          videoQuality={settings.video_quality}
          rotatingWords={settings.hero_rotating_words}
          ctaLabel={settings.hero_cta_primary_label}
          requireIdentity={requireIdentity}
        />

        <LandingStatsStrip stats={settings.landing_stats} eyebrow={titles.stats_eyebrow} />

        {featured.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-12">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
                Featured
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Courses to start with</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c: any) => {
                const thumb = resolveMediaUrl(c.thumbnail_url)
                return (
                  <Link
                    key={c.id}
                    href="/auth/login"
                    className="hover-lift group overflow-hidden rounded-2xl border border-border/60 bg-card/70"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <BookOpen className="h-10 w-10 text-bhutan-orange/60" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="line-clamp-2 text-base font-semibold tracking-tight">
                        {c.title}
                      </h3>
                      {c.description && (
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                          {c.description}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <section id="features" className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
              {titles.features_eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {titles.features_title}
            </h2>
            <p className="mt-4 text-muted-foreground">{titles.features_subtitle}</p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = resolveLandingIcon(f.icon)
              const tint = FEATURE_TINTS[i % FEATURE_TINTS.length]
              return (
                <article
                  key={`${f.title}-${i}`}
                  className="hover-lift group rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur"
                >
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border/50 bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
                {titles.steps_eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {stepsTitle}
              </h2>
              <p className="mt-4 text-muted-foreground">{stepsSubtitle}</p>
            </div>

            <ol
              className={`mt-14 grid gap-6 sm:grid-cols-2 ${
                steps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
              }`}
            >
              {steps.map((s, i) => {
                const Icon = resolveLandingIcon(s.icon)
                return (
                  <li
                    key={`${s.title}-${i}`}
                    className="relative rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur"
                  >
                    <span className="absolute right-5 top-5 text-4xl font-bold text-foreground/5">
                      {i + 1}
                    </span>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/10 text-bhutan-orange">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                  </li>
                )
              })}
            </ol>

            <div className="mt-12 flex justify-center">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-full bg-gradient-to-r from-bhutan-yellow to-bhutan-orange px-7 text-sm font-semibold text-black shadow-brand hover:opacity-95"
                render={<Link href="/auth/login" />}
              >
                Begin registration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-5 py-20 md:py-28">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
              {titles.faq_eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {titles.faq_title}
            </h2>
          </div>
          <div className="mt-10 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/50 backdrop-blur">
            {faq.map((f) => (
              <details
                key={f.question}
                className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium">
                  {f.question}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-bhutan-yellow/15 via-bhutan-orange/10 to-transparent px-6 py-14 text-center md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-20%,rgba(255,107,53,0.15),transparent_60%)]"
            />
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {titles.cta_title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{ctaSubtitle}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:bg-foreground/90"
                render={<Link href="/auth/login" />}
              >
                {settings.hero_cta_primary_label || 'Create your account'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteName} · Empowering education in Bhutan.
          </p>
          <nav className="flex items-center gap-5">
            <Link href="/download" className="transition-colors hover:text-foreground">
              Android app
            </Link>
            <Link href="/auth/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="#features" className="transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
