import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Download, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes, getAndroidRelease } from '@/lib/android-release'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Download Android app',
  description: 'Install the official Pelbu LMS Android APK. Built with the Android SDK and published only by a manual GitHub Action — not auto-pushed to Google Play.',
}

function formatDate(value: string | null) {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat('en-BT', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default async function DownloadAndroidPage() {
  const release = await getAndroidRelease()
  const size = formatBytes(release.sizeBytes)
  const published = formatDate(release.publishedAt)

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-950 dark:to-black">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pelbu
        </Link>

        <main className="my-auto py-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-bhutan-orange">
            Official Android app
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Pelbu LMS for Android
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            A genuine Android SDK app for Pelbu. Download the APK from this site, install it once, and grant camera, files, microphone, and notifications on first open.
          </p>

          <div className="mt-8 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-bhutan-yellow to-bhutan-orange text-white">
                <Smartphone className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">pelbu-lms.apk</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {release.available
                    ? [release.version, size, published].filter(Boolean).join(' · ')
                    : release.message || 'The APK is not published yet.'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {release.available ? (
                <Button
                  size="lg"
                  className="h-12 gap-2 rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:bg-foreground/90"
                  render={<a href={release.downloadPath} />}
                >
                  <Download className="h-4 w-4" />
                  Download APK
                </Button>
              ) : (
                <Button size="lg" className="h-12 rounded-full px-7" disabled>
                  APK not published yet
                </Button>
              )}
            </div>
          </div>

          <ul className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-bhutan-orange" />
              Built with the official Android SDK (Kotlin, AndroidX, target API 36). Google Play Protect looks for unused SMS, contacts, and call-log access — this app does not request those.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-bhutan-orange" />
              Published only when someone runs the GitHub Action by hand. Nothing auto-uploads to Google Play.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-bhutan-orange" />
              After download: open the APK → Allow from this source → Install → grant the permission sheet once. Android cannot grant camera or files at install time after Android 6; the app asks immediately on first launch so it will not keep prompting later.
            </li>
          </ul>
        </main>
      </div>
    </div>
  )
}
