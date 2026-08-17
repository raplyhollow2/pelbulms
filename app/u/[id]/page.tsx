'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveMediaUrl } from '@/lib/media'

export default function PublicStudentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [courses, setCourses] = useState<any[]>([])

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
      if (data) {
        const { data: settings } = await supabase
          .from('user_settings')
          .select('profile_visibility')
          .eq('user_id', id)
          .maybeSingle()
        if ((settings as any)?.profile_visibility === 'private') {
          setProfile(null)
          setLoading(false)
          return
        }
      }
      setProfile(data)
      if (data) {
        const { data: rows } = await supabase
          .from('enrollments')
          .select('progress_percentage, courses(id, title, thumbnail_url, is_published)')
          .eq('user_id', id)
          .eq('status', 'active')
          .limit(12)
        setCourses((rows || []).map((r: any) => r.courses).filter((c: any) => c?.is_published))
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-bhutan-yellow" />
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>Profile not found</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push('/courses')}>
          Back
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24 border-4 border-bhutan-yellow">
            <AvatarImage src={resolveMediaUrl(profile.avatar_url) || undefined} />
            <AvatarFallback className="text-2xl">
              {(profile.full_name || 'S').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-bold">{profile.full_name || 'Learner'}</h1>
            {profile.headline && <p className="text-muted-foreground">{profile.headline}</p>}
            {profile.location && <p className="text-sm text-muted-foreground">{profile.location}</p>}
            {profile.bio && <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((c) => (
          <Link key={c.id} href={`/courses/${c.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <p className="flex items-center gap-2 font-medium">
                  <BookOpen className="h-4 w-4 text-bhutan-yellow" />
                  {c.title}
                </p>
                <Badge variant="secondary" className="mt-2">
                  Enrolled
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
