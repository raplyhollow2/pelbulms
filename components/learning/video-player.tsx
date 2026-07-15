// @ts-nocheck - Supabase type inference issues documented in TYPESCRIPT_ISSUES.md
'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  RotateCw,
  Cast as Chromecast, // Using Cast icon instead of non-existent Chromecast
  Clock,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface VideoSource {
  url: string
  quality: string
  bitrate: number
  height: number
}

interface VideoPlayerProps {
  videoId: string
  sources: VideoSource[]
  poster?: string
  courseId: string
  moduleId: string
  userId: string
  autoPlay?: boolean
  onProgress?: (progress: number) => void
  onComplete?: () => void
}

interface VideoQuality {
  label: string
  resolution: string
  bitrate: number
  selected: boolean
}

interface PlaybackSpeed {
  label: string
  value: number
}

export function VideoPlayer({
  videoId,
  sources,
  poster,
  courseId,
  moduleId,
  userId,
  autoPlay = false,
  onProgress,
  onComplete
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online')
  const [savedProgress, setSavedProgress] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState(0)

  const qualities: VideoQuality[] = sources.map(source => ({
    label: source.quality,
    resolution: source.height.toString(),
    bitrate: source.bitrate,
    selected: source === sources[0]
  }))

  const playbackSpeeds: PlaybackSpeed[] = [
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: 'Normal', value: 1 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '2x', value: 2 }
  ]

  // Load saved progress
  useEffect(() => {
    const loadProgress = async () => {
      const { data, error } = await supabase
        .from('video_progress')
        .select('progress')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('module_id', moduleId)
        .single()

      if (data && !error) {
        setSavedProgress(data.progress)
        if (videoRef.current) {
          videoRef.current.currentTime = data.progress
        }
      }
    }

    loadProgress()
  }, [userId, courseId, moduleId])

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online')
    const handleOffline = () => setNetworkStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setNetworkStatus(navigator.onLine ? 'online' : 'offline')

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Save progress periodically
  useEffect(() => {
    const saveProgress = async () => {
      if (!currentTime || currentTime <= lastSaveTime) return

      const { error } = await supabase
        .from('video_progress')
        .upert({
          user_id: userId,
          course_id: courseId,
          module_id: moduleId,
          progress: currentTime,
          total_duration: duration,
          completed: currentTime >= duration * 0.9,
          last_watched: new Date().toISOString()
        })

      if (!error) {
        setLastSaveTime(currentTime)
        onProgress?.(currentTime)
      }
    }

    const saveInterval = setInterval(() => {
      if (isPlaying) {
        saveProgress()
      }
    }, 5000) // Save every 5 seconds

    return () => clearInterval(saveInterval)
  }, [currentTime, isPlaying, lastSaveTime, userId, courseId, moduleId, duration])

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(-5)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(5)
          break
        case 'ArrowUp':
          e.preventDefault()
          changeVolume(0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          changeVolume(-0.1)
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seek = (seconds: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime += seconds
  }

  const changeVolume = (delta: number) => {
    if (!videoRef.current) return
    const newVolume = Math.max(0, Math.min(1, volume + delta))
    setVolume(newVolume)
    videoRef.current.volume = newVolume
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    if (isMuted) {
      videoRef.current.volume = volume
      setIsMuted(false)
    } else {
      videoRef.current.volume = 0
      setIsMuted(true)
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const changeQuality = (quality: VideoQuality) => {
    if (!videoRef.current) return

    const currentTime = videoRef.current.currentTime
    const wasPlaying = !videoRef.current.paused

    const newSource = sources.find(s => s.height === parseInt(quality.resolution))
    if (newSource) {
      videoRef.current.src = newSource.url
      videoRef.current.currentTime = currentTime
      if (wasPlaying) {
        videoRef.current.play()
      }
    }

    setSelectedQuality(quality)
  }

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return
    videoRef.current.playbackRate = speed
    setPlaybackSpeed(speed)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleBuffering = () => {
    setIsBuffering(true)
    setTimeout(() => setIsBuffering(false), 1000)
  }

  const handleVideoEnd = () => {
    setIsPlaying(false)
    onComplete?.()
  }

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) return

    const hideControls = setTimeout(() => {
      setShowControls(false)
    }, 3000)

    return () => clearTimeout(hideControls)
  }, [isPlaying, showControls])

  if (networkStatus === 'offline') {
    return (
      <Alert variant="destructive">
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          You are currently offline. Please check your internet connection to continue watching.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full aspect-video"
        poster={poster}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration)
          }
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime)
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={handleBuffering}
        onCanPlay={() => setIsBuffering(false)}
        onEnded={handleVideoEnd}
        autoPlay={autoPlay}
      >
        <source src={sources[0]?.url} type="application/x-mpegURL" />
        Your browser does not support the video tag.
      </video>

      {/* Overlay controls */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <Badge variant="secondary">
            {selectedQuality?.label || sources[0]?.quality}
          </Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-white">
              <Chromecast className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Center play button */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-black ml-1" />
            </div>
          </button>
        )}

        {/* Buffering indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <RotateCw className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
          {/* Progress bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              className="cursor-pointer"
              onValueChange={([value]) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = value
                  setCurrentTime(value)
                }
              }}
            />
            <div className="flex items-center justify-between text-sm text-white">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={togglePlay} className="text-white">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>

              <Button size="sm" variant="ghost" onClick={() => seek(-10)} className="text-white">
                <RotateCw className="w-4 h-4 -scale-x-100" />
                <span className="ml-1 text-xs">10</span>
              </Button>

              <Button size="sm" variant="ghost" onClick={() => seek(10)} className="text-white">
                <RotateCw className="w-4 h-4" />
                <span className="ml-1 text-xs">10</span>
              </Button>

              <div className="flex items-center gap-2 ml-2">
                <Button size="sm" variant="ghost" onClick={toggleMute} className="text-white">
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  max={100}
                  step={1}
                  className="w-24"
                  onValueChange={([value]) => {
                    const newVolume = value / 100
                    setVolume(newVolume)
                    if (videoRef.current) {
                      videoRef.current.volume = newVolume
                    }
                    if (value > 0 && isMuted) {
                      setIsMuted(false)
                    }
                  }}
                />
              </div>

              <Badge variant="outline" className="text-white border-white/30">
                <Clock className="w-3 h-3 mr-1" />
                {playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Quality selector */}
              <select
                className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1"
                onChange={(e) => {
                  const quality = qualities.find(q => q.resolution === e.target.value)
                  if (quality) changeQuality(quality)
                }}
                value={selectedQuality?.resolution || sources[0]?.height.toString()}
              >
                {qualities.map((quality) => (
                  <option key={quality.resolution} value={quality.resolution} className="text-black">
                    {quality.label}
                  </option>
                ))}
              </select>

              {/* Speed selector */}
              <select
                className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1"
                onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                value={playbackSpeed}
              >
                {playbackSpeeds.map((speed) => (
                  <option key={speed.value} value={speed.value} className="text-black">
                    {speed.label}
                  </option>
                ))}
              </select>

              <Button size="sm" variant="ghost" onClick={toggleFullscreen} className="text-white">
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved progress indicator */}
      {savedProgress > 0 && (
        <Badge className="absolute top-4 right-20">
          Resume from {formatTime(savedProgress)}
        </Badge>
      )}
    </div>
  )
}

interface LearningInterfaceProps {
  courseId: string
  moduleId: string
  userId: string
}

export function LearningInterface({ courseId, moduleId, userId }: LearningInterfaceProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'resources' | 'notes' | 'discussion'>('video')

  const mockSources: VideoSource[] = [
    {
      url: 'https://example.com/video_1080p.m3u8',
      quality: '1080p',
      bitrate: 5000000,
      height: 1080
    },
    {
      url: 'https://example.com/video_720p.m3u8',
      quality: '720p',
      bitrate: 2500000,
      height: 720
    },
    {
      url: 'https://example.com/video_480p.m3u8',
      quality: '480p',
      bitrate: 1000000,
      height: 480
    },
    {
      url: 'https://example.com/video_360p.m3u8',
      quality: '360p',
      bitrate: 500000,
      height: 360
    }
  ]

  const handleProgress = (progress: number) => {
    console.log('Progress saved:', progress)
  }

  const handleComplete = () => {
    console.log('Video completed!')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Learning Interface</h2>
          <p className="text-gray-600 dark:text-gray-400">Interactive video learning</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          Online
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <VideoPlayer
            videoId="video-1"
            sources={mockSources}
            poster="https://example.com/poster.jpg"
            courseId={courseId}
            moduleId={moduleId}
            userId={userId}
            onProgress={handleProgress}
            onComplete={handleComplete}
          />
        </CardContent>
      </Card>

      {/* Additional learning resources */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="text-sm">• Course slides (PDF)</li>
              <li className="text-sm">• Source code</li>
              <li className="text-sm">• Additional reading</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Take notes while watching...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Discussion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Join the discussion with peers...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}