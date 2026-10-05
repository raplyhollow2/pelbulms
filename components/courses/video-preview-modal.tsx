'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Play, Pause, X, Volume2, VolumeX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { YoutubeFrame } from '@/components/course/youtube-frame'
import { DrivePreviewFrame } from '@/components/learning/drive-preview-frame'
import { resolveMediaUrl, parseMediaRef } from '@/lib/media'
import {
  getGoogleDriveEmbedUrl,
  getYoutubeId,
  isDirectVideoFile,
} from '@/lib/video-url'

interface VideoPreviewModalProps {
  courseId: string
  courseTitle: string
  previewVideoUrl?: string | null
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onEnroll?: () => void
}

export function VideoPreviewModal({
  courseTitle,
  previewVideoUrl,
  isOpen: controlledOpen,
  onOpenChange,
  onEnroll,
}: VideoPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const open = controlledOpen !== undefined ? controlledOpen : isOpen
  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOpen === undefined) setIsOpen(newOpen)
    onOpenChange?.(newOpen)
    if (!newOpen) {
      setIsPlaying(false)
      videoRef.current?.pause()
    }
  }

  const raw = (previewVideoUrl || '').trim()
  const resolved = resolveMediaUrl(raw) || raw
  const youtubeId = getYoutubeId(raw)
  const driveEmbed = getGoogleDriveEmbedUrl(raw)
  const isCloudinaryOrFile =
    Boolean(parseMediaRef(raw)?.type === 'video') ||
    isDirectVideoFile(resolved) ||
    (resolved.startsWith('http') && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(resolved))

  useEffect(() => {
    if (!open) return
    setIsPlaying(false)
  }, [open, raw])

  const handlePlayPause = async () => {
    const el = videoRef.current
    if (!el) return
    try {
      if (el.paused) {
        await el.play()
        setIsPlaying(true)
      } else {
        el.pause()
        setIsPlaying(false)
      }
    } catch {
      setIsPlaying(false)
    }
  }

  const hasVideo = Boolean(raw)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full gap-0 overflow-hidden bg-background/95 p-0 backdrop-blur-sm sm:max-w-4xl">
        <div className="relative">
          <div className="group relative aspect-video w-full overflow-hidden bg-black">
            {!hasVideo ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/20">
                <div className="text-center px-6">
                  <Play className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
                  <p className="text-primary/80 font-medium">No preview video yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The instructor has not uploaded a course preview.
                  </p>
                </div>
              </div>
            ) : youtubeId ? (
              <YoutubeFrame
                id={youtubeId}
                title={`${courseTitle} preview`}
                params={{ rel: 0, modestbranding: 1 }}
              />
            ) : driveEmbed ? (
              <DrivePreviewFrame
                src={driveEmbed}
                className="absolute inset-0 h-full w-full border-0 object-cover"
                title={`${courseTitle} preview`}
              />
            ) : isCloudinaryOrFile || resolved ? (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={resolved}
                  muted={isMuted}
                  controls
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
                <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => {
                      setIsMuted((m) => !m)
                      if (videoRef.current) videoRef.current.muted = !isMuted
                    }}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Unable to play this preview URL.</p>
              </div>
            )}

            <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-10">
              Preview
            </Badge>

            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white z-10"
              onClick={() => handleOpenChange(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 border-t border-border/50">
          <DialogHeader>
            <DialogTitle>{courseTitle}</DialogTitle>
            <DialogDescription>
              {hasVideo
                ? 'Watch a free preview to see if this course is right for you'
                : 'Enroll to access the full course content'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 mt-4">
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                handleOpenChange(false)
                onEnroll?.()
              }}
            >
              Enroll to Watch Full Course
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
