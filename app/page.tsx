import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { Rigbu } from '@/components/brand/rigbu'
import { SignedInPublicGuard } from '@/components/auth/signed-in-public-guard'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingCatalog, type LandingCourse } from '@/components/landing/landing-catalog'
import { LandingSection } from '@/components/landing/landing-section'
import {
  LandingCampus,
  LandingJoin,
  LandingJourney,
  LandingPrograms,
  LandingQuotes,
  LandingStats,
} from '@/components/landing/landing-sections'
import { publicHomeRedirectForSession } from '@/lib/auth-destination'
import { getPlatformSettings } from '@/lib/platform-settings'
import { cookies } from 'next/headers'
import { tryCreateServiceClient, createSupabaseServerClient } from '@/lib/supabase/server'
import {
  DEFAULT_LANDING_FAQ,
  DEFAULT_LANDING_FEATURES,
  DEFAULT_LANDING_SECTION_TITLES,
  DEFAULT_LANDING_STEPS,
  DEFAULT_LANDING_STEPS_NO_KYC,
  type LandingFaqItem,
  type LandingFeature,
  type LandingQuote,
  type LandingStep,
} from '@/lib/landing-content'
import { resolveMediaUrl } from '@/lib/media'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rigbu.bt'
const FALLBACK_NAME = 'Rigbu LMS'
const FALLBACK_DESCRIPTION =
  'Rigbu LMS is Bhutan’s private, identity-verified learning platform. Students and teachers get world-class courses, progress tracking, private video lessons and recognised certificates — access granted only after Bhutan KYC approval.'

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
      'Rigbu',
      'Pelsung',
      'Dessung',
      'Gelephu Mindfulness City education',
      'private video courses',
      'digital certificates Bhutan',
      'e-learning Bhutan',
    ],
    authors: [{ name: 'Rigbu' }],
    creator: 'Rigbu',
    publisher: 'Rigbu',
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

function instructorName(profiles: { full_name?: string | null } | { full_name?: string | null }[] | null) {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles
  return profile?.full_name?.trim() || null
}

function toLandingCourse(row: {
  id: string
  title: string
  category?: string | null
  thumbnail_url?: string | null
  average_rating?: number | null
  rating_count?: number | null
  profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null
}): LandingCourse {
  return {
    id: row.id,
    title: row.title,
    category: String(row.category || '').trim(),
    thumbnail_url: row.thumbnail_url || null,
    average_rating: Number(row.average_rating) || 0,
    rating_count: Number(row.rating_count) || 0,
    instructor_name: instructorName(row.profiles || null),
  }
}

async function loadLiveReviews(): Promise<LandingQuote[]> {
  try {
    const service = await tryCreateServiceClient()
    if (!service) return []
    const { data, error } = await service
      .from('reviews')
      .select('user_id, course_id, rating, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(24)
    if (error || !data?.length) return []

    const rows = data as {
      user_id: string
      course_id: string
      rating: number
      comment: string | null
    }[]
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
    const courseIds = [...new Set(rows.map((row) => row.course_id).filter(Boolean))]
    const [{ data: profiles }, { data: courses }] = await Promise.all([
      userIds.length
        ? service.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] }),
      courseIds.length
        ? service.from('courses').select('id, title, is_published').in('id', courseIds)
        : Promise.resolve({ data: [] }),
    ])
    const people = new Map(
      ((profiles || []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map(
        (profile) => [
          profile.id,
          {
            name: profile.full_name?.trim() || '',
            avatar_url: resolveMediaUrl(profile.avatar_url),
          },
        ]
      )
    )
    const courseById = new Map(
      ((courses || []) as { id: string; title: string | null; is_published: boolean | null }[]).map(
        (course) => [course.id, course]
      )
    )

    return rows
      .flatMap((row) => {
        const quote = (row.comment || '').trim()
        const course = courseById.get(row.course_id)
        const person = people.get(row.user_id)
        const name = person?.name || ''
        const role = course?.title?.trim() || ''
        if (!quote || !name || !role || course?.is_published === false) return []
        const stars = Math.min(5, Math.max(1, Math.round(Number(row.rating) || 0)))
        return [
          {
            quote,
            name,
            role,
            stars,
            avatar_url: person?.avatar_url || null,
            course_id: row.course_id,
          },
        ]
      })
      .slice(0, 12)
  } catch {
    return []
  }
}

async function loadPublishedCourses() {
  try {
    const service = await tryCreateServiceClient()
    const client = service || (await createSupabaseServerClient())
    const { data } = await client
      .from('courses')
      .select(
        'id, title, category, thumbnail_url, average_rating, rating_count, profiles:instructor_id ( full_name )'
      )
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
    return ((data || []) as unknown as Parameters<typeof toLandingCourse>[0][]).map((row) =>
      toLandingCourse(row)
    )
  } catch {
    return [] as LandingCourse[]
  }
}

function withAccessCard(features: LandingFeature[], requireIdentity: boolean): LandingFeature[] {
  if (requireIdentity) return features
  return features.map((feature) =>
    feature.title === 'Bhutan KYC access'
      ? {
          ...feature,
          icon: 'ShieldCheck',
          title: 'Trusted access',
          description:
            'Learners request a seat and the course creator approves it. A course can be limited to selected institutions or opened with an invite code.',
        }
      : feature
  )
}

function resolveFeatures(
  custom: LandingFeature[] | null,
  requireIdentity: boolean
): LandingFeature[] {
  const source = custom !== null ? custom : DEFAULT_LANDING_FEATURES
  return withAccessCard(source, requireIdentity)
}

function resolveSteps(custom: LandingStep[] | null, requireIdentity: boolean): LandingStep[] {
  if (custom !== null) return custom
  return requireIdentity ? DEFAULT_LANDING_STEPS : DEFAULT_LANDING_STEPS_NO_KYC
}

function resolveFaq(
  custom: LandingFaqItem[] | null,
  siteName: string,
  requireIdentity: boolean
): LandingFaqItem[] {
  if (custom?.length) {
    const browserInstall = DEFAULT_LANDING_FAQ.find(
      (item) => item.question === 'Is there an Android app?'
    )
    return custom.map((f) => {
      const answer =
        f.question.trim().toLowerCase() === 'is there an android app?' && browserInstall
          ? browserInstall.answer
          : f.answer
      return {
        question: f.question.replaceAll('Rigbu LMS', siteName).replaceAll('Rigbu', siteName),
        answer: answer.replaceAll('Rigbu LMS', siteName).replaceAll('Rigbu', siteName),
      }
    })
  }

  if (requireIdentity) {
    return DEFAULT_LANDING_FAQ.map((f) => ({
      question:
        f.question === 'What is Rigbu LMS?'
          ? `What is ${siteName}?`
          : f.question.replaceAll('Rigbu LMS', siteName).replaceAll('Rigbu', siteName),
      answer: f.answer.replaceAll('Rigbu LMS', siteName).replaceAll('Rigbu', siteName),
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

function isPreviewRequest(preview: string | string[] | undefined) {
  return preview === '1' || (Array.isArray(preview) && preview.includes('1'))
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>
}) {
  const params = await searchParams
  const preview = isPreviewRequest(params?.preview)
  let destination: string | null = null
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.includes('auth-token'))
  if (hasAuthCookie) {
    try {
      const supabase = await createSupabaseServerClient()
      const auth = await Promise.race([
        supabase.auth.getUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ])
      if (auth && !auth.error && auth.data.user) {
        const meta = auth.data.user.app_metadata ?? {}
        destination = publicHomeRedirectForSession({
          accountStatus: typeof meta.account_status === 'string' ? meta.account_status : null,
          role: typeof meta.role === 'string' ? meta.role : null,
          preview,
        })
      } else if (!auth) {
        destination = publicHomeRedirectForSession({ preview })
      }
    } catch {
      destination = publicHomeRedirectForSession({ preview })
    }
  }
  if (destination) redirect(destination)

  const settings = await getPlatformSettings()
  const siteName = settings.site_name || FALLBACK_NAME
  const requireIdentity = settings.require_identity_documents
  const description =
    settings.landing_description ||
    (requireIdentity
      ? FALLBACK_DESCRIPTION
      : `${siteName} is Bhutan’s learning platform for students, teachers and institutions.`)
  const [published, liveReviews] = await Promise.all([
    settings.public_catalog ? loadPublishedCourses() : Promise.resolve([] as LandingCourse[]),
    loadLiveReviews(),
  ])
  const publishedById = new Map(published.map((course) => [course.id, course]))
  const featured = settings.featured_course_ids
    .map((id) => publishedById.get(id))
    .filter((course): course is LandingCourse => Boolean(course))
  const heroFallbackImage =
    resolveMediaUrl(settings.hero_image_url) ||
    (featured[0] ? resolveMediaUrl(featured[0].thumbnail_url) : null)
  const footerCategories = published.reduce<string[]>((names, course) => {
    const name = course.category.trim()
    if (name && !names.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      names.push(name)
    }
    return names
  }, [])

  const titles = {
    ...DEFAULT_LANDING_SECTION_TITLES,
    ...settings.landing_section_titles,
  }

  const features = resolveFeatures(settings.landing_features, requireIdentity)
  const steps = resolveSteps(settings.landing_steps, requireIdentity)
  const faq = resolveFaq(settings.landing_faq, siteName, requireIdentity)

  const ctaSubtitle =
    titles.cta_subtitle ||
    (requireIdentity
      ? 'Join a verified community of learners and educators. Get approved, then start your first course today.'
      : 'Join learners and educators across Bhutan. Create an account and start your first course today.')

  return (
    <div className="min-h-screen bg-background">
      <SignedInPublicGuard allowPreview={preview} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(siteName, description, faq)) }}
      />

      <main className="min-w-0 overflow-visible">
        <LandingNav
          siteName={siteName}
          courses={published}
          glassOpacity={settings.hero_glass_opacity}
          mascotUrl={resolveMediaUrl(settings.mascot_image_url) || null}
        />
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
          secondaryCtaLabel={settings.hero_cta_secondary_label}
          showCatalog={settings.public_catalog && published.length > 0}
          requireIdentity={requireIdentity}
          fallbackImage={heroFallbackImage}
          courseTopics={published.map((course) => course.title)}
          heroSlides={settings.hero_slides}
          mascotUrl={resolveMediaUrl(settings.mascot_image_url) || null}
          siteNameForScene={siteName}
        />

        <LandingStats eyebrow={titles.stats_eyebrow} stats={settings.landing_stats} />

        <div id="courses">
          <LandingCatalog courses={published} featured={featured} />
        </div>

        <LandingPrograms
          eyebrow={titles.features_eyebrow}
          title={titles.features_title || 'Programs'}
          subtitle={titles.features_subtitle}
          features={features}
        />

        <LandingCampus title={titles.campus_title || 'Campus and learning spaces'} cards={settings.landing_campus} />

        <LandingJourney
          eyebrow={titles.steps_eyebrow}
          title={titles.steps_title || 'How to join'}
          subtitle={titles.steps_subtitle}
          steps={steps}
        />

        <LandingQuotes title={titles.quotes_title || 'Hear from the community'} quotes={liveReviews} />

        <LandingJoin
          images={settings.landing_gallery}
          title={titles.cta_title || 'Ready to learn?'}
          subtitle={ctaSubtitle}
          buttonLabel={settings.hero_cta_primary_label || 'Create your account'}
        />

        <LandingSection id="faq">
          <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              {titles.faq_eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {titles.faq_title}
            </h2>
          </div>
          <LandingFaq items={faq} />
          </div>
        </LandingSection>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-2">
            <Rigbu className="h-8 w-8" />
            <span>© {new Date().getFullYear()} {siteName} · Empowering education in Bhutan.</span>
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/auth/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="#features" className="transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </Link>
            {footerCategories.map((category) => (
              <Link
                key={category}
                href={`/courses?category=${encodeURIComponent(category)}`}
                className="transition-colors hover:text-foreground"
              >
                {category}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
