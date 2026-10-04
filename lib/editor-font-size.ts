const MIN_PX = 10
const MAX_PX = 96
const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE'])

function isBlock(node: Node) {
  return node instanceof HTMLElement && BLOCKS.has(node.tagName)
}

function fontSizeOf(root: HTMLElement, anchor: Node) {
  const element = anchor instanceof Element ? anchor : anchor.parentElement
  const target = element && root.contains(element) ? element : root
  const size = Number.parseFloat(window.getComputedStyle(target).fontSize)
  return Number.isFinite(size) ? size : 14
}

/** The size on screen. A heading often inherits 14px while its text span is larger. */
function visibleFontSize(root: HTMLElement, range: Range) {
  let node: Node | null = range.startContainer
  if (node instanceof HTMLElement) {
    const child = node.childNodes[Math.min(range.startOffset, Math.max(0, node.childNodes.length - 1))]
    if (child) node = child
  }
  while (node instanceof HTMLElement && node.firstChild) node = node.firstChild
  return fontSizeOf(root, node || range.startContainer)
}

/** About 20% per click, and the opposite click returns to the previous step. */
function nextFontSize(current: number, direction: 1 | -1) {
  const raw = direction > 0 ? current * 1.2 : current / 1.2
  let rounded = Math.round(raw)
  if (rounded === Math.round(current)) rounded += direction
  return Math.min(MAX_PX, Math.max(MIN_PX, rounded))
}

function clearNestedFontSize(element: HTMLElement) {
  element.querySelectorAll<HTMLElement>('*').forEach((child) => {
    child.style.fontSize = ''
    if (child.tagName === 'FONT') child.removeAttribute('size')
    if (!child.getAttribute('style')?.trim()) child.removeAttribute('style')
  })
}

function applyToElement(element: HTMLElement, px: string) {
  element.style.fontSize = px
  clearNestedFontSize(element)
}

function blockAncestor(root: HTMLElement, node: Node) {
  let current = node instanceof HTMLElement ? node : node.parentElement
  while (current && current !== root) {
    if (isBlock(current)) return current
    current = current.parentElement
  }
  return null
}

function sizeFragment(fragment: DocumentFragment, px: string) {
  for (const node of [...fragment.childNodes]) {
    if (node instanceof HTMLElement) {
      applyToElement(node, px)
      continue
    }
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const span = document.createElement('span')
      span.style.fontSize = px
      node.replaceWith(span)
      span.appendChild(node)
    }
  }
}

/**
 * Steps the selection up or down. A caret with no selection resizes the
 * paragraph or heading around it. Existing inline sizes are replaced so a
 * click always changes what is on screen.
 */
export function stepSelectionFontSize(root: HTMLElement, direction: 1 | -1) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !root.contains(selection.anchorNode)) {
    return false
  }
  const saved = selection.getRangeAt(0).cloneRange()
  root.focus()
  selection.removeAllRanges()
  selection.addRange(saved)
  const range = selection.getRangeAt(0)
  const px = `${nextFontSize(visibleFontSize(root, range), direction)}px`

  if (range.collapsed) {
    const block = blockAncestor(root, selection.anchorNode)
    const parent = selection.anchorNode.parentElement
    const target =
      parent && parent !== root && root.contains(parent) && !isBlock(parent) ? parent : block
    if (!target) return false
    applyToElement(target, px)
    return true
  }

  const fragment = range.extractContents()
  sizeFragment(fragment, px)
  const sized = [...fragment.childNodes]
  range.insertNode(fragment)
  if (sized.length > 0) {
    const nextRange = document.createRange()
    nextRange.setStartBefore(sized[0])
    nextRange.setEndAfter(sized[sized.length - 1])
    selection.removeAllRanges()
    selection.addRange(nextRange)
  }
  return true
}
