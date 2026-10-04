import type { Metadata } from 'next'
import { courseDescriptionPlain } from '@/lib/course-description'
import { getCloudinaryAccount } from '@/lib/cloudinary'
import { parseMediaRef } from '@/lib/media'
import { tryCreateServiceClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pelbu.bt'

async function publicThumbnail(ref: string | null | undefined) {
  if (!ref) return null
  if (/^https?:\/\//i.test(ref)) return ref
  const parsed = parseMediaRef(ref)
  if (parsed?.type === 'image') {
    const account = await getCloudinaryAccount()
    if (!account) return null
    return `https://res.cloudinary.com/${account.cloudName}/image/upload/${parsed.publicId}`
  }
  if (ref.startsWith('/')) return `${SITE_URL}${ref}`
  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const generic: Metadata = {
    title: 'Course',
    description: 'View this course on Pelbu LMS.',
    robots: { index: false, follow: false },
  }

  const service = await tryCreateServiceClient()
  if (!service) return generic

  const { data } = await service
    .from('courses')
    .select('title, description, thumbnail_url, is_published')
    .eq('id', id)
    .maybeSingle()

  if (!data?.is_published || !data.title) return generic

  const title = data.title
  const description =
    courseDescriptionPlain(data.description).slice(0, 200) || 'View this course on Pelbu LMS.'
  const url = `${SITE_URL}/courses/${id}`
  const image = (await publicThumbnail(data.thumbnail_url)) || `${SITE_URL}/icon.svg`

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default function CourseDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
