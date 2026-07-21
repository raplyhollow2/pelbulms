'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Copy,
  Film,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  Check,
  HardDrive,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { canAccessTeaching } from '@/lib/roles'
import { uploadVideoDirectToCloudinary, uploadImageDirectToCloudinary } from '@/lib/cloudinary-direct-upload'
import { MAX_VIDEO_UPLOAD_LABEL, MAX_IMAGE_UPLOAD_LABEL } from '@/lib/video-url'
import { resolveMediaUrl } from '@/lib/media'

type MediaAsset = {
  id: string
  name: string
  kind: 'video' | 'image' | 'document' | 'other'
  source: 'cloudinary' | 'supabase'
  url: string
  previewUrl?: string | null
  size?: number
  format?: string
  createdAt?: string
  folder?: string
  publicId?: string
}

function formatBytes(n?: number) {
  if (!n || n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function TeachMediaLibraryPage() {
  const router = useRouter()
  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [kindTab, setKindTab] = useState<'all' | 'video' | 'image' | 'document'>('all')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!canAccessTeaching((profile as any)?.role)) {
        alert('Access denied')
        router.push('/dashboard')
        return
      }

      const res = await fetch('/api/teach/media')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load media')
      setAssets(data.assets || [])
      setCloudinaryConfigured(Boolean(data.cloudinaryConfigured))
    } catch (e: any) {
      setError(e?.message || 'Failed to load media library')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const filtered = assets.filter((a) => {
    if (kindTab !== 'all' && a.kind !== kindTab) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.folder?.toLowerCase().includes(q) ||
      a.url.toLowerCase().includes(q)
    )
  })

  const copyRef = async (asset: MediaAsset) => {
    try {
      await navigator.clipboard.writeText(asset.url)
      setCopiedId(asset.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setMessage('Could not copy — select and copy the URL manually')
    }
  }

  const removeAsset = async (asset: MediaAsset) => {
    if (!confirm(`Delete “${asset.name}”? This cannot be undone.`)) return
    try {
      const path =
        asset.source === 'supabase'
          ? asset.id.replace(/^supabase:lesson-resources:/, '')
          : undefined
      const res = await fetch('/api/teach/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: asset.id,
          source: asset.source,
          publicId: asset.publicId,
          path,
          kind: asset.kind,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setAssets((prev) => prev.filter((a) => a.id !== asset.id))
      setMessage('Asset deleted')
    } catch (e: any) {
      setMessage(e?.message || 'Delete failed')
    }
  }

  const uploadVideo = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    setMessage('')
    try {
      await uploadVideoDirectToCloudinary(file, {
        folder: 'course-media/videos/library',
        onProgress: setUploadProgress,
      })
      setMessage('Video uploaded to Cloudinary (compressed).')
      await load()
    } catch (e: any) {
      if (file.size > 20 * 1024 * 1024) {
        setMessage(e?.message || 'Video upload failed')
        return
      }
      try {
        const body = new FormData()
        body.append('file', file)
        body.append('courseId', 'library')
        body.append('kind', 'video')
        const res = await fetch('/api/courses/media', { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || e?.message || 'Upload failed')
        setMessage('Video uploaded.')
        await load()
      } catch (err: any) {
        setMessage(err?.message || e?.message || 'Video upload failed')
      }
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    setMessage('')
    try {
      await uploadImageDirectToCloudinary(file, {
        folder: 'course-media/images/library',
      })
      setMessage('Image uploaded. Copy the URL into a course cover or lesson.')
      await load()
    } catch (e: any) {
      if (file.size > 8 * 1024 * 1024) {
        setMessage(e?.message || 'Image upload failed')
        return
      }
      try {
        const body = new FormData()
        body.append('file', file)
        body.append('courseId', 'library')
        body.append('kind', 'image')
        const res = await fetch('/api/courses/media', { method: 'POST', body })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        setMessage('Image uploaded. Copy the URL into a course cover or lesson.')
        await load()
      } catch (err: any) {
        setMessage(err?.message || e?.message || 'Image upload failed')
      }
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const uploadDoc = async (file: File) => {
    setUploading(true)
    setMessage('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('courseId', 'library')
      body.append('lessonId', 'shared')
      body.append('title', file.name)
      const res = await fetch('/api/courses/resources', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setMessage(`Document uploaded. URL: ${data.resource?.url || ''}`)
      await load()
    } catch (e: any) {
      setMessage(e?.message || 'Document upload failed')
    } finally {
      setUploading(false)
      if (docInputRef.current) docInputRef.current.value = ''
    }
  }

  const kindIcon = (kind: string) => {
    if (kind === 'video') return <Film className="w-4 h-4 text-bhutan-yellow" />
    if (kind === 'image') return <ImageIcon className="w-4 h-4 text-bhutan-orange" />
    return <FileText className="w-4 h-4 text-muted-foreground" />
  }

  return (
    <div className="container mx-auto px-4 py-6 lg:py-8 space-y-6 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/teach/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <HardDrive className="w-7 h-7 text-bhutan-yellow" />
            Media library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and manage videos, images, and documents. Copy a reference into any lesson or course.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {!cloudinaryConfigured && (
        <Card className="border-amber-500/40">
          <CardContent className="py-3 text-sm text-amber-800 dark:text-amber-300">
            Cloudinary is not configured. Large video uploads need{' '}
            <code className="text-xs">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code>,{' '}
            <code className="text-xs">CLOUDINARY_API_KEY</code>, and{' '}
            <code className="text-xs">CLOUDINARY_API_SECRET</code>.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Upload</CardTitle>
          <CardDescription>
            Videos go to Cloudinary (up to {MAX_VIDEO_UPLOAD_LABEL}, auto-compressed). Images up to{' '}
            {MAX_IMAGE_UPLOAD_LABEL} upload directly too. Documents go to
            lesson storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadVideo(f)
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadImage(f)
            }}
          />
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.xls,.xlsx,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadDoc(f)
            }}
          />
          <Button
            type="button"
            disabled={uploading}
            className="bg-bhutan-yellow text-black hover:bg-bhutan-orange gap-1.5"
            onClick={() => videoInputRef.current?.click()}
          >
            <UploadCloud className="w-4 h-4" />
            Upload video
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            className="gap-1.5"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="w-4 h-4" />
            Upload image
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            className="gap-1.5"
            onClick={() => docInputRef.current?.click()}
          >
            <FileText className="w-4 h-4" />
            Upload PDF / PPT
          </Button>
          {uploading && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {uploadProgress > 0 ? `${uploadProgress}%` : 'Uploading…'}
            </span>
          )}
        </CardContent>
      </Card>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Assets ({filtered.length})</CardTitle>
            <Input
              placeholder="Search by name or folder…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
          </div>
          <Tabs value={kindTab} onValueChange={(v: any) => setKindTab(v)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="video">Videos</TabsTrigger>
              <TabsTrigger value="image">Images</TabsTrigger>
              <TabsTrigger value="document">Documents</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-bhutan-yellow" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No assets yet. Upload a video, image, or document above.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((asset) => (
                <div
                  key={asset.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3 bg-background/50"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-14 h-14 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {asset.kind === 'image' && (asset.previewUrl || resolveMediaUrl(asset.url)) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.previewUrl || resolveMediaUrl(asset.url) || ''}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        kindIcon(asset.kind)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{asset.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {asset.kind}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {asset.source}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(asset.size)}
                          {asset.format ? ` · ${asset.format}` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1 font-mono">
                        {asset.url}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => copyRef(asset)}
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copy ref
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeAsset(asset)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
