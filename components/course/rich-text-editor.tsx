'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Mic,
  Video,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  uploadAudioDirectToCloudinary,
  uploadImageDirectToCloudinary,
  uploadVideoDirectToCloudinary,
} from '@/lib/cloudinary-direct-upload'
import { stepSelectionFontSize } from '@/lib/editor-font-size'
import { resolveMediaUrl } from '@/lib/media'
import { presentRichHtml, richMediaClass, safeLinkHref, sanitizeRichHtml } from '@/lib/rich-html'
import { MAX_AUDIO_UPLOAD_BYTES, MAX_AUDIO_UPLOAD_LABEL, MAX_VOICE_RECORDING_MS } from '@/lib/video-url'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

function prepareLessonHtml(value: string) {
  return presentRichHtml(value || '<p></p>')
}

function FormatButton({
  label,
  onApply,
  disabled,
  children,
}: {
  label: string
  onApply: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={onApply}
    >
      {children}
    </button>
  )
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function altFromName(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[<>&"']/g, '').trim().slice(0, 120)
}

function preferredAudioMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function anchorFromSelection(root: HTMLElement) {
  const selection = window.getSelection()
  const node = selection?.anchorNode
  if (!node || !root.contains(node)) return null
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest('a') ?? null
}

export function RichTextEditor({
  id,
  value,
  onChange,
  onCommit,
  placeholder,
  ariaLabel = 'Text',
  courseId,
  prepareIncoming = prepareLessonHtml,
  cleanPaste,
  surfaceClassName = 'prose prose-sm dark:prose-invert min-h-32 w-full max-w-none rounded-md border bg-background p-3 text-sm focus:outline-none',
}: {
  id?: string
  value: string
  onChange: (html: string) => void
  onCommit?: (html: string) => void
  placeholder?: string
  ariaLabel?: string
  courseId?: string
  prepareIncoming?: (value: string) => string
  cleanPaste?: (source: string) => string
  surfaceClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focused = useRef(false)
  const lastPublished = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)
  const mounted = useRef(true)
  const busyRef = useRef(false)
  const recordingRef = useRef(false)
  const discardRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [linkError, setLinkError] = useState('')
  const [busy, setBusy] = useState<'image' | 'video' | 'audio' | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [canRecord, setCanRecord] = useState<boolean | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setCanRecord(
      typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    )
    return () => {
      mounted.current = false
      discardRef.current = true
      const recorder = recorderRef.current
      recorderRef.current = null
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  // Uncontrolled on purpose. React 19 assigns innerHTML again whenever
  // dangerouslySetInnerHTML is a new object, which wiped each keystroke and format.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    if (lastPublished.current === value) return
    if (focused.current) return
    node.innerHTML = prepareIncoming(value)
    lastPublished.current = value
  }, [prepareIncoming, value])

  const publish = () => {
    const next = sanitizeRichHtml(ref.current?.innerHTML || '')
    lastPublished.current = next
    onChange(next)
    return next
  }

  const rememberSelection = () => {
    const node = ref.current
    const selection = window.getSelection()
    savedRange.current =
      selection && selection.rangeCount > 0 && node?.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null
  }

  const restoreSelection = () => {
    const node = ref.current
    const selection = window.getSelection()
    if (!node || !selection || !savedRange.current) return
    node.focus()
    focused.current = true
    selection.removeAllRanges()
    try {
      selection.addRange(savedRange.current)
    } catch {
      const range = document.createRange()
      range.selectNodeContents(node)
      range.collapse(false)
      selection.addRange(range)
    }
  }

  const insertHtml = (html: string) => {
    const node = ref.current
    if (!node) return
    restoreSelection()
    focused.current = true
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !node.contains(selection.anchorNode)) {
      node.focus()
      const range = document.createRange()
      range.selectNodeContents(node)
      range.collapse(false)
      const current = window.getSelection()
      current?.removeAllRanges()
      current?.addRange(range)
    }
    const range = window.getSelection()?.getRangeAt(0)
    if (!range) return
    range.deleteContents()
    const template = document.createElement('template')
    template.innerHTML = html
    const last = template.content.lastChild
    range.insertNode(template.content)
    if (last) {
      const after = document.createRange()
      after.setStartAfter(last)
      after.collapse(true)
      const current = window.getSelection()
      current?.removeAllRanges()
      current?.addRange(after)
      savedRange.current = after.cloneRange()
    }
    publish()
  }

  const apply = (command: string) => {
    const node = ref.current
    if (!node) return
    node.focus()
    focused.current = true
    document.execCommand('styleWithCSS', false, command.startsWith('justify') ? 'true' : 'false')
    document.execCommand(command)
    publish()
  }

  const changeFontSize = (direction: 1 | -1) => {
    const node = ref.current
    if (!node) return
    focused.current = true
    if (stepSelectionFontSize(node, direction)) publish()
  }

  const locked = busy !== null || recording

  const uploadImage = async (file: File) => {
    if (busyRef.current || recordingRef.current) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Use a JPG, PNG, WEBP, GIF, or AVIF picture.')
      return
    }
    busyRef.current = true
    setBusy('image')
    setError('')
    try {
      const uploaded = await uploadImageDirectToCloudinary(file, {
        folder: `course-media/images/${courseId || 'library'}`,
      })
      if (!mounted.current) return
      const alt = altFromName(file.name)
      insertHtml(`<img src="${escapeAttr(uploaded.url)}" alt="${escapeAttr(alt)}">`)
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not upload the picture.')
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(null)
    }
  }

  const uploadVideo = async (file: File) => {
    if (!courseId || busyRef.current || recordingRef.current) return
    busyRef.current = true
    setBusy('video')
    setProgress(0)
    setError('')
    try {
      const uploaded = await uploadVideoDirectToCloudinary(file, {
        folder: `course-media/inline/${courseId}`,
        onProgress: (percent) => {
          if (mounted.current) setProgress(percent)
        },
      })
      if (!mounted.current) return
      const playable = resolveMediaUrl(uploaded.url)
      if (!playable) throw new Error('Could not prepare the video')
      insertHtml(
        `<video controls playsinline preload="metadata" src="${escapeAttr(playable)}"></video>`
      )
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not upload the video.')
    } finally {
      busyRef.current = false
      if (mounted.current) {
        setBusy(null)
        setProgress(null)
      }
    }
  }

  const uploadVoice = async (file: File) => {
    if (!courseId || busyRef.current) return
    busyRef.current = true
    setBusy('audio')
    setError('')
    try {
      const uploaded = await uploadAudioDirectToCloudinary(file, {
        folder: `course-media/inline/${courseId}`,
      })
      if (!mounted.current) return
      const playable = resolveMediaUrl(uploaded.url)
      if (!playable) throw new Error('Could not prepare the recording')
      insertHtml(`<audio controls preload="metadata" src="${escapeAttr(playable)}"></audio>`)
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not upload the recording.')
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(null)
    }
  }

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleRecorderStop = (recorder: MediaRecorder) => {
    const type = recorder.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type })
    chunksRef.current = []
    recorderRef.current = null
    releaseStream()
    recordingRef.current = false
    if (mounted.current) setRecording(false)
    if (!mounted.current || discardRef.current) {
      discardRef.current = false
      return
    }
    if (blob.size > MAX_AUDIO_UPLOAD_BYTES) {
      setError(`Recording is too large. Maximum size is ${MAX_AUDIO_UPLOAD_LABEL}.`)
      return
    }
    const base = type.split(';')[0] || 'audio/webm'
    const ext = base.includes('mp4')
      ? 'm4a'
      : base.includes('ogg')
        ? 'ogg'
        : base.includes('wav')
          ? 'wav'
          : base.includes('mpeg')
            ? 'mp3'
            : 'webm'
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: base })
    void uploadVoice(file)
  }

  const startRecording = async () => {
    if (!courseId || canRecord !== true || busyRef.current || recordingRef.current) return
    setError('')
    rememberSelection()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const mime = preferredAudioMime()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      discardRef.current = false
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => handleRecorderStop(recorder)
      streamRef.current = stream
      recorderRef.current = recorder
      recordingRef.current = true
      setRecording(true)
      recorder.start()
      timerRef.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop()
      }, MAX_VOICE_RECORDING_MS)
    } catch (err) {
      releaseStream()
      recordingRef.current = false
      if (!mounted.current) return
      const name = err instanceof DOMException ? err.name : ''
      setError(
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Microphone permission was denied.'
          : 'Could not start recording.'
      )
    }
  }

  const finishRecording = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }

  const cancelRecording = () => {
    discardRef.current = true
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    releaseStream()
    recordingRef.current = false
    setRecording(false)
  }

  const openLink = () => {
    const node = ref.current
    if (!node) return
    rememberSelection()
    const current = anchorFromSelection(node)?.getAttribute('href') || ''
    setLinkUrl(current || 'https://')
    setLinkError('')
    setLinkOpen(true)
  }

  const applyLink = () => {
    const node = ref.current
    if (!node) return
    const href = safeLinkHref(linkUrl)
    if (!href) {
      setLinkError('Enter a web address, such as https://example.com')
      return
    }
    restoreSelection()
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.textContent = linkUrl.trim() || href
      const range = savedRange.current
      if (range) range.insertNode(anchor)
      else node.appendChild(anchor)
    } else {
      document.execCommand('createLink', false, href)
    }
    publish()
    setLinkOpen(false)
    setLinkError('')
  }

  const removeLink = () => {
    restoreSelection()
    document.execCommand('unlink')
    publish()
    setLinkOpen(false)
    setLinkError('')
  }

  const voiceTitle = !courseId
    ? 'Open this from a course to add video and voice.'
    : canRecord === false
      ? 'This browser cannot record audio.'
      : 'Record voice'
  const videoTitle = courseId ? 'Video' : 'Open this from a course to add video and voice.'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <FormatButton label="Bold" onApply={() => apply('bold')}>
          <Bold />
        </FormatButton>
        <FormatButton label="Italic" onApply={() => apply('italic')}>
          <Italic />
        </FormatButton>
        <FormatButton label="Decrease font size" onApply={() => changeFontSize(-1)}>
          <span className="text-[11px] font-semibold leading-none">A−</span>
        </FormatButton>
        <FormatButton label="Increase font size" onApply={() => changeFontSize(1)}>
          <span className="text-sm font-semibold leading-none">A+</span>
        </FormatButton>
        <FormatButton label="Link" onApply={openLink}>
          <Link2 />
        </FormatButton>
        <FormatButton label="Bulleted list" onApply={() => apply('insertUnorderedList')}>
          <List />
        </FormatButton>
        <FormatButton label="Numbered list" onApply={() => apply('insertOrderedList')}>
          <ListOrdered />
        </FormatButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <FormatButton label="Align left" onApply={() => apply('justifyLeft')}>
          <AlignLeft />
        </FormatButton>
        <FormatButton label="Align center" onApply={() => apply('justifyCenter')}>
          <AlignCenter />
        </FormatButton>
        <FormatButton label="Align right" onApply={() => apply('justifyRight')}>
          <AlignRight />
        </FormatButton>
        <FormatButton label="Justify" onApply={() => apply('justifyFull')}>
          <AlignJustify />
        </FormatButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <FormatButton
          label="Picture"
          disabled={locked}
          onApply={() => {
            rememberSelection()
            imageInput.current?.click()
          }}
        >
          {busy === 'image' ? <Loader2 className="animate-spin" /> : <ImageIcon />}
        </FormatButton>
        <FormatButton
          label={videoTitle}
          disabled={locked || !courseId}
          onApply={() => {
            rememberSelection()
            videoInput.current?.click()
          }}
        >
          {busy === 'video' ? <Loader2 className="animate-spin" /> : <Video />}
        </FormatButton>
        <FormatButton
          label={voiceTitle}
          disabled={locked || !courseId || canRecord !== true}
          onApply={() => {
            void startRecording()
          }}
        >
          {busy === 'audio' ? <Loader2 className="animate-spin" /> : <Mic />}
        </FormatButton>
      </div>
      <input
        ref={imageInput}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void uploadImage(file)
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void uploadVideo(file)
        }}
      />
      {linkOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`${id || 'rich-text'}-link`}>
            Link address
          </label>
          <Input
            id={`${id || 'rich-text'}-link`}
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value)
              setLinkError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              }
            }}
            placeholder="https://example.com"
            autoFocus
            className="h-9 min-w-48 flex-1"
          />
          <Button type="button" size="sm" className="min-h-9" onClick={applyLink}>
            Apply
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={removeLink}>
            Remove
          </Button>
          {linkError ? <p className="w-full text-xs text-destructive">{linkError}</p> : null}
        </div>
      ) : null}
      {recording ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">Recording voice</p>
          <Button type="button" size="sm" className="min-h-9" onClick={finishRecording}>
            Stop and insert
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={cancelRecording}>
            Cancel
          </Button>
        </div>
      ) : null}
      {busy === 'video' && progress !== null ? (
        <p className="text-xs text-muted-foreground">Uploading video… {progress}%</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div
        ref={ref}
        id={id}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        className={`${surfaceClassName} ${richMediaClass}`}
        onFocus={() => {
          focused.current = true
        }}
        onPaste={(event) => {
          const images = Array.from(event.clipboardData.files).filter((file) =>
            file.type.startsWith('image/')
          )
          if (images.length) {
            event.preventDefault()
            rememberSelection()
            void (async () => {
              for (const file of images) await uploadImage(file)
            })()
            return
          }
          const html = event.clipboardData.getData('text/html')
          const text = event.clipboardData.getData('text/plain')
          if (!html.trim() && !/<\/?[a-z][^>]*>/i.test(text)) return
          event.preventDefault()
          const source = html.trim() || text
          const clean = cleanPaste ? cleanPaste(source) : presentRichHtml(source)
          if (!clean) return
          document.execCommand('insertHTML', false, clean)
          publish()
        }}
        onInput={publish}
        onBlur={() => {
          focused.current = false
          const next = publish()
          onCommit?.(next)
        }}
      />
    </div>
  )
}
