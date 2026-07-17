import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  GraduationCap,
  Lock,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingHero } from '@/components/landing/landing-hero'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pelbu.bt'
const SITE_NAME = 'Pelbu LMS'
const DESCRIPTION =
  'Pelbu LMS is Bhutan’s private, identity-verified learning platform. Students and teachers get world-class courses, progress tracking, private video lessons and recognised certificates — access granted only after Bhutan KYC approval.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Pelbu LMS — Bhutan’s Private Learning Platform',
    template: '%s · Pelbu LMS',
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Bhutan LMS',
    'learning management system Bhutan',
    'online courses Bhutan',
    'Pelbu',
    'Pelsung',
    'Gelephu Mindfulness City education',
    'KYC verified learning',
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
    siteName: SITE_NAME,
    title: 'Pelbu LMS — Bhutan’s Private Learning Platform',
    description: DESCRIPTION,
    images: [{ url: '/icon.svg', width: 512, height: 512, alt: 'Pelbu LMS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pelbu LMS — Bhutan’s Private Learning Platform',
    description: DESCRIPTION,
    images: ['/icon.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

const FEATURES = [
  {
    icon: Lock,
    title: 'Private video lessons',
    desc: 'Lessons stream through our own servers with signed, expiring links — never downloadable or exposed in the browser.',
    tint: 'text-bhutan-orange bg-bhutan-orange/10',
  },
  {
    icon: BarChart3,
    title: 'Real progress tracking',
    desc: 'Watch-time is measured per lesson. Courses complete automatically at 90% — no gaming the system.',
    tint: 'text-bhutan-yellow bg-bhutan-yellow/15',
  },
  {
    icon: BadgeCheck,
    title: 'Verified certificates',
    desc: 'Auto-issued PDF certificates with a public verification page and unique code for employers.',
    tint: 'text-green-600 bg-green-600/10',
  },
  {
    icon: ScanFace,
    title: 'Bhutan KYC access',
    desc: 'Every account is verified with CID and passport photo, then approved by an assigned reviewer.',
    tint: 'text-bhutan-red bg-bhutan-red/10',
  },
  {
    icon: GraduationCap,
    title: 'Effortless authoring',
    desc: 'Teachers build courses, modules, lessons, quizzes and exams in a streamlined, autosaving workflow.',
    tint: 'text-blue-600 bg-blue-600/10',
  },
  {
    icon: Sparkles,
    title: 'Built for mobile',
    desc: 'An app-like experience with offline support, installable PWA, and a fast, luxurious interface.',
    tint: 'text-purple-600 bg-purple-600/10',
  },
]

const STEPS = [
  {
    icon: UserPlus,
    title: 'Sign in with Google',
    desc: 'Start with a single secure Google sign-in — no passwords to remember.',
  },
  {
    icon: ScanFace,
    title: 'Complete Bhutan KYC',
    desc: 'Submit your CID number, CID photo, passport photo and institution — the details that verify you as a genuine learner.',
  },
  {
    icon: ShieldCheck,
    title: 'Get approved',
    desc: 'An assigned reviewer or superadmin confirms your identity and role. This keeps Pelbu a trusted, closed network.',
  },
  {
    icon: GraduationCap,
    title: 'Start learning',
    desc: 'Once approved, your dashboard, courses and certificates unlock instantly.',
  },
]

const FAQ = [
  {
    q: 'What is Pelbu LMS?',
    a: 'Pelbu LMS is Bhutan’s private learning management platform. It offers identity-verified access, private video courses, progress tracking and recognised certificates for students, teachers and institutions.',
  },
  {
    q: 'How do I get access to Pelbu?',
    a: 'Sign in with Google, complete the Bhutan KYC registration form (CID number, CID photo, passport photo and your institution), then wait for an assigned reviewer to approve your account. Access to the dashboard and courses unlocks after approval.',
  },
  {
    q: 'Why does Pelbu require KYC verification?',
    a: 'Pelbu is a closed system for verified learners in Bhutan. KYC verification with CID and passport photo ensures certificates are trustworthy and the network stays free of anonymous or fake accounts.',
  },
  {
    q: 'Are the course videos private?',
    a: 'Yes. Videos are stored privately and streamed through Pelbu’s own servers using signed, expiring links. They cannot be downloaded or discovered through the browser’s inspector.',
  },
  {
    q: 'Do I get a certificate?',
    a: 'Yes. When you complete a course, Pelbu automatically issues a PDF certificate with a unique code and a public verification page that anyone can use to confirm its authenticity.',
  },
]

function jsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: DESCRIPTION,
        areaServed: { '@type': 'Country', name: 'Bhutan' },
        logo: `${SITE_URL}/icon.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en',
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      <main>
        <LandingHero />

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
              Why Pelbu
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              A learning platform unlike any other
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every detail engineered for trust, focus and results — not clutter.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="hover-lift group rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur"
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.tint}`}
                >
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Registration process */}
        <section id="how-it-works" className="border-y border-border/50 bg-muted/30">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
                Getting started
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Four steps to join Pelbu
              </h2>
              <p className="mt-4 text-muted-foreground">
                Pelbu is a verified, closed network. Here’s exactly how access works.
              </p>
            </div>

            <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className="relative rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur"
                >
                  <span className="absolute right-5 top-5 text-4xl font-bold text-foreground/5">
                    {i + 1}
                  </span>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/10 text-bhutan-orange">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </li>
              ))}
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

        {/* FAQ (also powers AEO / rich results) */}
        <section id="faq" className="mx-auto max-w-3xl px-5 py-20 md:py-28">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
              Answers
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="mt-10 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/50 backdrop-blur">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium">
                  {f.q}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-bhutan-yellow/15 via-bhutan-orange/10 to-transparent px-6 py-14 text-center md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-20%,rgba(255,107,53,0.15),transparent_60%)]"
            />
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to learn with the best in Bhutan?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join a verified community of learners and educators. Get approved, then start your
              first course today.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:bg-foreground/90"
                render={<Link href="/auth/login" />}
              >
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Pelbu LMS · Empowering education in Bhutan.</p>
          <nav className="flex items-center gap-5">
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
