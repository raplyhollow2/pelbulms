'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { courseDescriptionEditorHtml, courseDescriptionRichClass } from '@/lib/course-description'
import { stepSelectionFontSize } from '@/lib/editor-font-size'
import { sanitizeHtml } from '@/lib/lesson-blocks'

function FormatButton({
  label,
  onApply,
  children,
}: {
  label: string
  onApply: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onApply}
    >
      {children}
    </button>
  )
}

/** http(s), mailto, or a same-site path. Anything else is dropped. */
function safeLinkHref(raw: string): string | null {
  const value = raw.trim()
  if (!value || /^(javascript|data|vbscript):/i.test(value)) return null
  if (/^mailto:/i.test(value)) {
    const address = value.slice('mailto:'.length).trim()
    if (!address || /[\s<>"]/.test(address)) return null
    return `mailto:${address}`
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function hardenAnchors(root: HTMLElement) {
  root.querySelectorAll('a').forEach((anchor) => {
    const safe = safeLinkHref(anchor.getAttribute('href') || '')
    if (!safe) {
      anchor.replaceWith(document.createTextNode(anchor.textContent || ''))
      return
    }
    anchor.setAttribute('href', safe)
    anchor.setAttribute('rel', 'noopener noreferrer')
    if (/^https?:/i.test(safe)) anchor.setAttribute('target', '_blank')
    else anchor.removeAttribute('target')
  })
}

function anchorFromSelection(root: HTMLElement) {
  const selection = window.getSelection()
  const node = selection?.anchorNode
  if (!node || !root.contains(node)) return null
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest('a') ?? null
}

export function DescriptionEditor({
  id,
  value,
  onChange,
  onCommit,
  placeholder = 'Write what this is about',
  ariaLabel = 'Description',
}: {
  id?: string
  value: string
  onChange: (html: string) => void
  onCommit?: (html: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focused = useRef(false)
  const lastPublished = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [linkError, setLinkError] = useState('')

  // Uncontrolled on purpose. React 19 assigns innerHTML again whenever
  // dangerouslySetInnerHTML is a new object, which wiped each keystroke and format.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    if (lastPublished.current === value) return
    if (focused.current) return
    node.innerHTML = value.trim() ? courseDescriptionEditorHtml(value) : ''
    lastPublished.current = value
  }, [value])

  const publish = () => {
    const node = ref.current
    if (node) hardenAnchors(node)
    const next = sanitizeHtml(node?.innerHTML || '')
    lastPublished.current = next
    onChange(next)
    return next
  }

  const restoreSelection = () => {
    const node = ref.current
    const selection = window.getSelection()
    if (!node || !selection || !savedRange.current) return
    node.focus()
    focused.current = true
    selection.removeAllRanges()
    selection.addRange(savedRange.current)
  }

  const apply = (command: string) => {
    const node = ref.current
    if (!node) return
    node.focus()
    focused.current = true
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(command)
    publish()
  }

  const changeFontSize = (direction: 1 | -1) => {
    const node = ref.current
    if (!node) return
    focused.current = true
    if (stepSelectionFontSize(node, direction)) publish()
  }

  const openLink = () => {
    const node = ref.current
    if (!node) return
    const selection = window.getSelection()
    savedRange.current =
      selection && selection.rangeCount > 0 && node.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null
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
      </div>
      {linkOpen ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            applyLink()
          }}
        >
          <label className="sr-only" htmlFor={`${id || 'description'}-link`}>
            Link address
          </label>
          <Input
            id={`${id || 'description'}-link`}
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value)
              setLinkError('')
            }}
            placeholder="https://example.com"
            autoFocus
            className="h-9 min-w-48 flex-1"
          />
          <Button type="submit" size="sm" className="min-h-9">
            Apply
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={removeLink}>
            Remove
          </Button>
          {linkError ? <p className="w-full text-xs text-destructive">{linkError}</p> : null}
        </form>
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
        className={`min-h-28 w-full cursor-text rounded-md border-2 border-foreground/30 bg-background p-3 text-sm leading-relaxed focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] ${courseDescriptionRichClass}`}
        onFocus={() => {
          focused.current = true
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
