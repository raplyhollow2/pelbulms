'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BringToFront,
  Copy,
  ImagePlus,
  Lock,
  SendToBack,
  Trash2,
  Type,
  Unlock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  CERT_BG_PRESETS,
  CERT_COLOR_SWATCHES,
  CERT_INSERT_ASSETS,
  CERT_TEMPLATES,
} from '@/lib/certificate-assets'
import {
  CERT_CANVAS,
  CERT_FONTS,
  newLayerId,
  resolveCertificateText,
  type CertificateLayout,
  type CertificateLayer,
} from '@/lib/certificate-layout'

type LayoutUpdater = CertificateLayout | ((prev: CertificateLayout) => CertificateLayout)

type Props = {
  layout: CertificateLayout
  onChange: (next: LayoutUpdater) => void
  sampleName?: string
  sampleCourse?: string
  onUploadAsset?: (file: File) => Promise<string>
  uploading?: boolean
}

type Sel =
  | { kind: 'layer'; id: string }
  | { kind: 'logo'; id: string }
  | null

type DragMode =
  | { type: 'move'; id: string; kind: 'layer' | 'logo'; dx: number; dy: number }
  | {
      type: 'resize'
      id: string
      kind: 'layer' | 'logo'
      handle: 'nw' | 'ne' | 'sw' | 'se'
      startX: number
      startY: number
      startW: number
      startH: number
      originX: number
      originY: number
    }

const MIN_SIZE = 24

export function CertificateEditor({
  layout,
  onChange,
  sampleName = 'Student Name',
  sampleCourse = 'Course title',
  onUploadAsset,
  uploading,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<Sel>(null)
  const [scale, setScale] = useState(0.55)
  const [assetTab, setAssetTab] = useState<'templates' | 'text' | 'shapes' | 'decor' | 'brand'>('templates')
  const drag = useRef<DragMode | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => {
      const width = el.clientWidth
      if (width <= 0) return
      setScale(Math.min(0.85, Math.max(0.28, (width - 16) / CERT_CANVAS.width)))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sortedLayers = useMemo(
    () => [...layout.layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [layout.layers]
  )

  const selectedLayer =
    selected?.kind === 'layer' ? layout.layers.find((l) => l.id === selected.id) : undefined
  const selectedLogo =
    selected?.kind === 'logo' ? layout.logos.find((l) => l.id === selected.id) : undefined

  const toDesignPoint = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * CERT_CANVAS.width,
      y: ((clientY - rect.top) / rect.height) * CERT_CANVAS.height,
    }
  }

  const updateLayer = (id: string, patch: Partial<CertificateLayer>) => {
    onChange((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }

  const updateLogo = (id: string, patch: Partial<(typeof layout.logos)[0]>) => {
    onChange((prev) => ({
      ...prev,
      logos: prev.logos.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }

  const addLayer = (layer: CertificateLayer) => {
    onChange((prev) => ({ ...prev, layers: [...prev.layers, layer] }))
    setSelected({ kind: 'layer', id: layer.id })
  }

  const removeSelected = () => {
    if (!selected) return
    if (selected.kind === 'logo') {
      const id = selected.id
      onChange((prev) => ({ ...prev, logos: prev.logos.filter((l) => l.id !== id) }))
    } else {
      const id = selected.id
      onChange((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== id) }))
    }
    setSelected(null)
  }

  const duplicateSelected = () => {
    if (selected?.kind !== 'layer' || !selectedLayer) return
    const copy: CertificateLayer = {
      ...selectedLayer,
      id: newLayerId('copy'),
      x: selectedLayer.x + 24,
      y: selectedLayer.y + 24,
      zIndex: (selectedLayer.zIndex ?? 10) + 1,
    }
    addLayer(copy)
  }

  const nudgeZ = (dir: 'front' | 'back') => {
    if (!selectedLayer) return
    const zs = layout.layers.map((l) => l.zIndex ?? 0)
    const next = dir === 'front' ? Math.max(...zs, 0) + 1 : Math.min(...zs, 0) - 1
    updateLayer(selectedLayer.id, { zIndex: next })
  }

  const onPointerDownMove = (
    e: React.PointerEvent,
    kind: 'layer' | 'logo',
    id: string,
    x: number,
    y: number,
    locked?: boolean
  ) => {
    if (locked) {
      setSelected({ kind, id })
      return
    }
    e.stopPropagation()
    const point = toDesignPoint(e.clientX, e.clientY)
    drag.current = { type: 'move', kind, id, dx: point.x - x, dy: point.y - y }
    setSelected({ kind, id })
    surfaceRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerDownResize = (
    e: React.PointerEvent,
    kind: 'layer' | 'logo',
    id: string,
    handle: 'nw' | 'ne' | 'sw' | 'se',
    box: { x: number; y: number; w: number; h: number }
  ) => {
    e.stopPropagation()
    const point = toDesignPoint(e.clientX, e.clientY)
    drag.current = {
      type: 'resize',
      kind,
      id,
      handle,
      startX: box.x,
      startY: box.y,
      startW: box.w,
      startH: box.h,
      originX: point.x,
      originY: point.y,
    }
    setSelected({ kind, id })
    surfaceRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const point = toDesignPoint(e.clientX, e.clientY)
    const mode = drag.current

    if (mode.type === 'move') {
      const x = Math.max(0, Math.min(CERT_CANVAS.width - 20, point.x - mode.dx))
      const y = Math.max(0, Math.min(CERT_CANVAS.height - 16, point.y - mode.dy))
      if (mode.kind === 'logo') updateLogo(mode.id, { x, y })
      else updateLayer(mode.id, { x, y })
      return
    }

    const dx = point.x - mode.originX
    const dy = point.y - mode.originY
    let { startX: x, startY: y, startW: w, startH: h } = mode

    if (mode.handle.includes('e')) w = Math.max(MIN_SIZE, mode.startW + dx)
    if (mode.handle.includes('s')) h = Math.max(MIN_SIZE, mode.startH + dy)
    if (mode.handle.includes('w')) {
      w = Math.max(MIN_SIZE, mode.startW - dx)
      x = mode.startX + (mode.startW - w)
    }
    if (mode.handle.includes('n')) {
      h = Math.max(MIN_SIZE, mode.startH - dy)
      y = mode.startY + (mode.startH - h)
    }

    x = Math.max(0, Math.min(CERT_CANVAS.width - MIN_SIZE, x))
    y = Math.max(0, Math.min(CERT_CANVAS.height - MIN_SIZE, y))

    if (mode.kind === 'logo') updateLogo(mode.id, { x, y, w, h })
    else updateLayer(mode.id, { x, y, w, h })
  }

  const endDrag = () => {
    drag.current = null
  }

  const borderClass =
    layout.borderStyle === 'none'
      ? ''
      : layout.borderStyle === 'double'
        ? 'border-[6px] border-double'
        : layout.borderStyle === 'ornate'
          ? 'border-[10px] border-double'
          : 'border-4'

  const resolve = (layer: CertificateLayer) => {
    const raw =
      layer.type === 'title' && layout.titleLine
        ? layout.titleLine
        : layer.type === 'tagline' && layout.tagline
          ? layout.tagline
          : layer.text || ''
    return resolveCertificateText(raw, {
      name: sampleName,
      course: sampleCourse,
    })
  }

  const insertAssets = CERT_INSERT_ASSETS.filter((a) =>
    assetTab === 'text'
      ? a.category === 'text'
      : assetTab === 'shapes'
        ? a.category === 'shapes'
        : assetTab === 'decor'
          ? a.category === 'decor'
          : false
  )

  return (
    <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border bg-[#1e1e1e] text-white lg:flex-row">
      {/* Left asset library */}
      <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-[#252525] lg:w-64 lg:border-b-0 lg:border-r">
        <div className="grid grid-cols-5 gap-0.5 border-b border-white/10 p-1.5 text-[10px] font-medium uppercase tracking-wide">
          {(
            [
              ['templates', 'Templates'],
              ['text', 'Text'],
              ['shapes', 'Shapes'],
              ['decor', 'Decor'],
              ['brand', 'Brand'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAssetTab(id)}
              className={cn(
                'rounded-md px-1 py-2 transition-colors',
                assetTab === id ? 'bg-bhutan-yellow text-black' : 'text-white/70 hover:bg-white/10'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {assetTab === 'templates' &&
            CERT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(t.apply(layout))
                  setSelected(null)
                }}
                className="w-full rounded-lg border border-white/10 bg-[#2e2e2e] p-3 text-left transition hover:border-bhutan-yellow/60"
              >
                {t.id === 'ornamental' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/certificates/molhr-ornamental-border.png"
                    alt=""
                    className="mb-2 h-14 w-full rounded border border-white/10 object-cover bg-white"
                  />
                ) : (
                  <div
                    className="mb-2 h-14 rounded border-2"
                    style={{ borderColor: t.previewAccent, background: '#fffef8' }}
                  />
                )}
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-white/50">{t.description}</div>
              </button>
            ))}

          {(assetTab === 'text' || assetTab === 'shapes' || assetTab === 'decor') &&
            insertAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => addLayer(asset.create(layout.accentColor))}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-[#2e2e2e] px-3 py-2.5 text-left text-sm transition hover:border-bhutan-yellow/60"
              >
                <Type className="h-4 w-4 shrink-0 text-bhutan-yellow" />
                <span>
                  <span className="block font-medium">{asset.label}</span>
                  {asset.description ? (
                    <span className="block text-xs text-white/45">{asset.description}</span>
                  ) : null}
                </span>
              </button>
            ))}

          {assetTab === 'brand' && (
            <div className="space-y-3">
              <div>
                <Label className="text-white/70">Background</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {CERT_BG_PRESETS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      title={bg.label}
                      onClick={() => onChange({ ...layout, backgroundColor: bg.color })}
                      className={cn(
                        'h-10 rounded-md border-2',
                        layout.backgroundColor === bg.color
                          ? 'border-bhutan-yellow'
                          : 'border-white/20'
                      )}
                      style={{ background: bg.color }}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  className="mt-2 h-10 w-full cursor-pointer bg-transparent p-1"
                  value={layout.backgroundColor}
                  onChange={(e) => onChange({ ...layout, backgroundColor: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-white/70">Accent / border color</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CERT_COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        'h-7 w-7 rounded-full border-2',
                        layout.accentColor === c ? 'border-white' : 'border-transparent'
                      )}
                      style={{ background: c }}
                      onClick={() => onChange({ ...layout, accentColor: c })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-white/70">Border style</Label>
                <select
                  className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#1e1e1e] px-3 text-sm"
                  value={layout.borderStyle}
                  onChange={(e) =>
                    onChange({
                      ...layout,
                      borderStyle: e.target.value as CertificateLayout['borderStyle'],
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="ornate">Ornate</option>
                </select>
              </div>
              <div>
                <Label className="text-white/70">Upload image / logo</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                    onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !onUploadAsset) return
                    const url = await onUploadAsset(file)
                    if (!url) return
                    onChange((prev) => ({
                      ...prev,
                      // Logos must never become signatureUrl
                      signatureUrl: undefined,
                      logos: [
                        ...prev.logos,
                        {
                          id: newLayerId('logo'),
                          src: url,
                          x: 80 + prev.logos.length * 40,
                          y: 40,
                          w: 120,
                          h: 60,
                        },
                      ],
                    }))
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 min-h-11 w-full border-white/20 bg-transparent text-white hover:bg-white/10"
                  disabled={!onUploadAsset || uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Add digital asset'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Canvas stage */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => setScale((s) => Math.max(0.25, s - 0.08))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs text-white/60">{Math.round(scale * 100)}%</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => setScale((s) => Math.min(1.2, s + 0.08))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="mx-2 h-4 w-px bg-white/15" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            disabled={!selected}
            onClick={duplicateSelected}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            disabled={!selectedLayer}
            onClick={() => nudgeZ('front')}
          >
            <BringToFront className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            disabled={!selectedLayer}
            onClick={() => nudgeZ('back')}
          >
            <SendToBack className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            disabled={!selectedLayer}
            onClick={() =>
              selectedLayer && updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })
            }
          >
            {selectedLayer?.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-red-300 hover:bg-white/10"
            disabled={!selected}
            onClick={removeSelected}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div
          ref={wrapRef}
          className="flex flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_1px_1px,#3a3a3a_1px,transparent_0)] [background-size:16px_16px] p-4"
        >
          <div
            className="relative shrink-0"
            style={{
              width: CERT_CANVAS.width * scale,
              height: CERT_CANVAS.height * scale,
            }}
          >
            <div
              ref={surfaceRef}
              className={cn('absolute left-0 top-0 origin-top-left overflow-hidden shadow-2xl', borderClass)}
              style={{
                width: CERT_CANVAS.width,
                height: CERT_CANVAS.height,
                transform: `scale(${scale})`,
                borderColor: layout.accentColor,
                backgroundColor: layout.backgroundColor,
                touchAction: 'none',
              }}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={() => setSelected(null)}
            >
              {layout.backgroundImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={layout.backgroundImage}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
                />
              ) : null}
              {layout.logos.map((logo) => {
                const isSel = selected?.kind === 'logo' && selected.id === logo.id
                return (
                  <div key={logo.id} className="absolute" style={{ left: logo.x, top: logo.y, width: logo.w, height: logo.h }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.src}
                      alt=""
                      draggable={false}
                      className={cn(
                        'h-full w-full cursor-move object-contain',
                        isSel && 'ring-2 ring-bhutan-yellow'
                      )}
                      onPointerDown={(e) => onPointerDownMove(e, 'logo', logo.id, logo.x, logo.y)}
                    />
                    {isSel && (
                      <ResizeHandles
                        onResize={(e, handle) =>
                          onPointerDownResize(e, 'logo', logo.id, handle, logo)
                        }
                      />
                    )}
                  </div>
                )
              })}

              {sortedLayers.map((layer) => {
                const isSel = selected?.kind === 'layer' && selected.id === layer.id
                return (
                  <div
                    key={layer.id}
                    className={cn(
                      'absolute',
                      layer.locked ? 'cursor-default' : 'cursor-move',
                      isSel && 'ring-2 ring-bhutan-yellow'
                    )}
                    style={{
                      left: layer.x,
                      top: layer.y,
                      width: layer.w,
                      height: layer.h,
                      opacity: layer.opacity ?? 1,
                      transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                      zIndex: layer.zIndex ?? 1,
                    }}
                    onPointerDown={(e) =>
                      onPointerDownMove(e, 'layer', layer.id, layer.x, layer.y, layer.locked)
                    }
                  >
                    <LayerVisual
                      layer={layer}
                      layout={layout}
                      text={resolve(layer)}
                    />
                    {isSel && !layer.locked && (
                      <ResizeHandles
                        onResize={(e, handle) =>
                          onPointerDownResize(e, 'layer', layer.id, handle, layer)
                        }
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <p className="border-t border-white/10 px-3 py-2 text-xs text-white/45">
          Drag anything on the canvas. Use corner handles to resize. Tokens: {'{{recipient}}'},{' '}
          {'{{course}}'}, {'{{date}}'}, {'{{code}}'}, {'{{cid}}'}.
        </p>
      </div>

      {/* Right properties */}
      <aside className="w-full shrink-0 border-t border-white/10 bg-[#252525] p-3 lg:w-72 lg:border-l lg:border-t-0">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
          Properties
        </h3>
        {!selectedLayer && !selectedLogo && (
          <div className="space-y-3 text-sm text-white/60">
            <p>Select an element on the canvas, or add one from the asset library.</p>
            <div>
              <Label className="text-white/70">Certificate title</Label>
              <Input
                className="mt-1 min-h-11 border-white/15 bg-[#1e1e1e] text-white"
                value={layout.titleLine}
                onChange={(e) => {
                  const titleLine = e.target.value
                  onChange({
                    ...layout,
                    titleLine,
                    layers: layout.layers.map((l) =>
                      l.type === 'title' ? { ...l, text: titleLine } : l
                    ),
                  })
                }}
              />
            </div>
            <div>
              <Label className="text-white/70">Tagline</Label>
              <Input
                className="mt-1 min-h-11 border-white/15 bg-[#1e1e1e] text-white"
                value={layout.tagline}
                onChange={(e) => {
                  const tagline = e.target.value
                  onChange({
                    ...layout,
                    tagline,
                    layers: layout.layers.map((l) =>
                      l.type === 'tagline' ? { ...l, text: tagline } : l
                    ),
                  })
                }}
              />
            </div>
          </div>
        )}

        {selectedLogo && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Logo / image</p>
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="X"
                value={selectedLogo.x}
                onChange={(x) => updateLogo(selectedLogo.id, { x })}
              />
              <NumField
                label="Y"
                value={selectedLogo.y}
                onChange={(y) => updateLogo(selectedLogo.id, { y })}
              />
              <NumField
                label="W"
                value={selectedLogo.w}
                onChange={(w) => updateLogo(selectedLogo.id, { w })}
              />
              <NumField
                label="H"
                value={selectedLogo.h}
                onChange={(h) => updateLogo(selectedLogo.id, { h })}
              />
            </div>
          </div>
        )}

        {selectedLayer && (
          <div className="space-y-3">
            <p className="text-sm font-medium capitalize">{selectedLayer.type} layer</p>
            {selectedLayer.type !== 'shape' && selectedLayer.type !== 'seal' && (
              <>
                <div>
                  <Label className="text-white/70">Text</Label>
                  <Textarea
                    className="mt-1 min-h-[72px] border-white/15 bg-[#1e1e1e] text-white"
                    value={selectedLayer.text || ''}
                    onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-white/70">Font size</Label>
                  <Input
                    type="number"
                    className="mt-1 min-h-11 border-white/15 bg-[#1e1e1e] text-white"
                    value={selectedLayer.fontSize || 16}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) || 16 })
                    }
                  />
                </div>
                <div>
                  <Label className="text-white/70">Font family</Label>
                  <select
                    className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#1e1e1e] px-3 text-sm"
                    value={selectedLayer.fontFamily || 'sans'}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, {
                        fontFamily: e.target.value as CertificateLayer['fontFamily'],
                      })
                    }
                  >
                    <option value="serif">Serif</option>
                    <option value="sans">Sans</option>
                    <option value="script">Script</option>
                  </select>
                </div>
                <div>
                  <Label className="text-white/70">Align</Label>
                  <div className="mt-1 flex gap-1">
                    {(
                      [
                        ['left', AlignLeft],
                        ['center', AlignCenter],
                        ['right', AlignRight],
                      ] as const
                    ).map(([align, Icon]) => (
                      <Button
                        key={align}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          'flex-1 border-white/20 bg-transparent text-white hover:bg-white/10',
                          selectedLayer.align === align && 'border-bhutan-yellow text-bhutan-yellow'
                        )}
                        onClick={() => updateLayer(selectedLayer.id, { align })}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-white/70">Text color</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {CERT_COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          'h-7 w-7 rounded-full border-2',
                          selectedLayer.color === c ? 'border-white' : 'border-transparent'
                        )}
                        style={{ background: c }}
                        onClick={() => updateLayer(selectedLayer.id, { color: c })}
                      />
                    ))}
                  </div>
                  <Input
                    type="color"
                    className="mt-2 h-10 w-full cursor-pointer bg-transparent p-1"
                    value={selectedLayer.color || '#111827'}
                    onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                  />
                </div>
              </>
            )}
            {(selectedLayer.type === 'shape' || selectedLayer.type === 'seal') && (
              <div>
                <Label className="text-white/70">Fill / stroke</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    type="color"
                    className="h-10 flex-1 cursor-pointer bg-transparent p-1"
                    value={(selectedLayer.fill || layout.accentColor).slice(0, 7)}
                    onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                  />
                  <Input
                    type="color"
                    className="h-10 flex-1 cursor-pointer bg-transparent p-1"
                    value={(selectedLayer.stroke || layout.accentColor).slice(0, 7)}
                    onChange={(e) => updateLayer(selectedLayer.id, { stroke: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="X"
                value={selectedLayer.x}
                onChange={(x) => updateLayer(selectedLayer.id, { x })}
              />
              <NumField
                label="Y"
                value={selectedLayer.y}
                onChange={(y) => updateLayer(selectedLayer.id, { y })}
              />
              <NumField
                label="W"
                value={selectedLayer.w}
                onChange={(w) => updateLayer(selectedLayer.id, { w })}
              />
              <NumField
                label="H"
                value={selectedLayer.h}
                onChange={(h) => updateLayer(selectedLayer.id, { h })}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div>
      <Label className="text-white/70">{label}</Label>
      <Input
        type="number"
        className="mt-1 min-h-10 border-white/15 bg-[#1e1e1e] text-white"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  )
}

function ResizeHandles({
  onResize,
}: {
  onResize: (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => void
}) {
  const handles: Array<{ id: 'nw' | 'ne' | 'sw' | 'se'; className: string }> = [
    { id: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { id: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { id: 'sw', className: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
    { id: 'se', className: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
  ]
  return (
    <>
      {handles.map((h) => (
        <span
          key={h.id}
          className={cn(
            'absolute z-50 h-3 w-3 rounded-sm border border-black bg-bhutan-yellow',
            h.className
          )}
          onPointerDown={(e) => onResize(e, h.id)}
        />
      ))}
    </>
  )
}

function LayerVisual({
  layer,
  layout,
  text,
}: {
  layer: CertificateLayer
  layout: CertificateLayout
  text: string
}) {
  // Signature text stays text-only. Signature / logo images are separate canvas logos
  // so an uploaded org logo is never glued to the instructor name.
  if (layer.type === 'signature') {
    const family = CERT_FONTS[layer.fontFamily || 'sans']
    return (
      <div
        className="flex h-full flex-col items-center justify-end overflow-hidden px-1"
        style={{
          color: layer.color || '#111827',
          fontFamily: family,
          textAlign: layer.align || 'center',
        }}
      >
        <div
          className="w-full text-sm font-semibold leading-tight"
          style={{ fontSize: layer.fontSize || 14 }}
        >
          {layout.signatureName || text || 'Instructor'}
        </div>
        {layout.signatureTitle ? (
          <div className="w-full text-[11px] leading-tight text-gray-500">{layout.signatureTitle}</div>
        ) : null}
      </div>
    )
  }

  if (layer.type === 'image' && layer.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={layer.src} alt="" className="h-full w-full object-contain" draggable={false} />
  }

  if (layer.type === 'seal') {
    const stroke = layer.stroke || layout.accentColor
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle cx="50" cy="50" r="46" fill="none" stroke={stroke} strokeWidth="3" />
          <circle cx="50" cy="50" r="38" fill="none" stroke={stroke} strokeWidth="1.5" />
        </svg>
        <span
          className="relative z-10 text-center text-[10px] font-bold tracking-widest"
          style={{ color: stroke }}
        >
          {layer.text || 'SEAL'}
        </span>
      </div>
    )
  }

  if (layer.type === 'shape') {
    const fill = layer.fill || 'transparent'
    const stroke = layer.stroke || layout.accentColor
    const sw = layer.strokeWidth ?? 2
    if (layer.shape === 'ellipse') {
      return (
        <div
          className="h-full w-full rounded-full"
          style={{ background: fill, border: `${sw}px solid ${stroke}` }}
        />
      )
    }
    if (layer.shape === 'line') {
      return (
        <div
          className="h-full w-full"
          style={{
            background: stroke,
            height: Math.max(sw, 2),
            marginTop: Math.max(0, (layer.h - Math.max(sw, 2)) / 2),
          }}
        />
      )
    }
    if (layer.shape === 'triangle') {
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
          <polygon points="50,5 95,95 5,95" fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      )
    }
    if (layer.shape === 'ribbon') {
      return (
        <svg viewBox="0 0 200 40" className="h-full w-full" preserveAspectRatio="none">
          <path
            d="M10 0 H190 L200 20 L190 40 H10 L0 20 Z"
            fill={fill === 'transparent' ? stroke : fill}
          />
        </svg>
      )
    }
    if (layer.shape === 'corner') {
      return (
        <svg viewBox="0 0 72 72" className="h-full w-full">
          <path
            d="M8 64 V8 H64"
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="square"
          />
          <path
            d="M20 64 V20 H64"
            fill="none"
            stroke={stroke}
            strokeWidth={Math.max(1, sw - 1)}
            opacity={0.55}
          />
        </svg>
      )
    }
    return (
      <div className="h-full w-full" style={{ background: fill, border: `${sw}px solid ${stroke}` }} />
    )
  }

  const family = CERT_FONTS[layer.fontFamily || 'sans']
  return (
    <div
      className="h-full w-full overflow-hidden whitespace-pre-wrap px-1 leading-tight"
      style={{
        color: layer.color || '#111827',
        fontSize: layer.fontSize || 16,
        textAlign: layer.align || 'center',
        fontFamily: family,
        fontWeight: layer.fontWeight || (layer.type === 'title' || layer.type === 'recipient' ? 700 : 500),
        letterSpacing: layer.letterSpacing ? `${layer.letterSpacing}px` : undefined,
      }}
    >
      {text}
    </div>
  )
}

/** @deprecated Prefer CertificateEditor — kept for any legacy imports */
export { CertificateEditor as CertificateCanvas }
