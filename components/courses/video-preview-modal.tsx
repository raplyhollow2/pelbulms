'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Play, X, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface VideoPreviewModalProps {
  courseId: string
  courseTitle: string
  previewVideoUrl?: string
  previewDuration?: number
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function VideoPreviewModal({
  courseId,
  courseTitle,
  previewVideoUrl,
  previewDuration = 120, // Default 2 minutes
  isOpen: controlledOpen,
  onOpenChange,
}: VideoPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(controlledOpen || false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration] = useState(previewDuration)

  // Handle controlled/uncontrolled state
  const open = controlledOpen !== undefined ? controlledOpen : isOpen
  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setIsOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isPlaying && currentTime < duration) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false)
            return duration
          }
          return prev + 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isPlaying, currentTime, duration])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0])
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 bg-background/95 backdrop-blur-sm">
        <div className="relative">
          {/* Video Player Container */}
          <div className="relative aspect-video bg-black group">
            {/* Video Content */}
            {previewVideoUrl ? (
              <video
                className="w-full h-full"
                src={previewVideoUrl}
                poster={`/api/og/courses/${courseId}`}
                muted={isMuted}
                controls={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bhutan-yellow/20 to-bhutan-orange/20">
                <div className="text-center">
                  <Play className="w-16 h-16 text-bhutan-yellow mx-auto mb-4 opacity-50" />
                  <p className="text-bhutan-yellow/70 font-medium">Course Preview</p>
                </div>
              </div>
            )}

            {/* Play/Pause Overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handlePlayPause}
            >
              <Button
                size="icon"
                variant="ghost"
                className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm"
              >
                {isPlaying ? (
                  <X className="w-8 h-8 text-white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" />
                )}
              </Button>
            </div>

            {/* Preview Badge */}
            <Badge className="absolute top-4 left-4 bg-bhutan-yellow text-black">
              Free Preview
            </Badge>

            {/* Close Button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => handleOpenChange(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Controls */}
          <div className="bg-background border-t border-border/50 p-4 space-y-3">
            {/* Progress Bar */}
            <div className="space-y-1">
              <Progress
                value={(currentTime / duration) * 100}
                className="h-1 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const percentage = x / rect.width
                  handleSeek([percentage * duration])
                }}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>

                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-muted-foreground">Preview</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                  </Badge>
                </div>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-4 border-t border-border/50">
          <DialogHeader>
            <DialogTitle>{courseTitle}</DialogTitle>
            <DialogDescription>
              Watch a free preview to see if this course is right for you
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 mt-4">
            <Button
              className="flex-1 bg-bhutan-yellow hover:bg-bhutan-orange text-black"
              onClick={() => handleOpenChange(false)}
            >
              Enroll Now to Watch Full Course
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
            >
              Browse Course Content
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}