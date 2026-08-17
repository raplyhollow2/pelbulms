'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CERT_CANVAS,
  type CertificateLayout,
  type CertificateLayer,
} from '@/lib/certificate-layout'

type Props = {
  layout: CertificateLayout
  onChange: (next: CertificateLayout) => void
  sampleName?: string
  sampleCourse?: string
}

export function CertificateCanvas({
  layout,
  onChange,
  sampleName = 'Student Name',
  sampleCourse = 'Course title',
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [scale, setScale] = useState(0.5)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => {
      const width = el.clientWidth
      if (width <= 0) return
      setScale(Math.min(1, width / CERT_CANVAS.width))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const toDesignPoint = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * CERT_CANVAS.width,
      y: ((clientY - rect.top) / rect.height) * CERT_CANVAS.height,
    }
  }

  const resolveText = (layer: CertificateLayer) => {
    const raw =
      layer.type === 'title' && layout.titleLine
        ? layout.titleLine
        : layer.type === 'tagline' && layout.tagline
          ? layout.tagline
          : layer.text || ''
    return raw
      .replace('{{recipient}}', sampleName)
      .replace('{{course}}', sampleCourse)
      .replace('{{date}}', new Date().toLocaleDateString())
      .replace('{{code}}', 'CERT-PREVIEW')
  }

  const onPointerDown = (e: React.PointerEvent, id: string, x: number, y: number) => {
    e.stopPropagation()
    const point = toDesignPoint(e.clientX, e.clientY)
    drag.current = { id, dx: point.x - x, dy: point.y - y }
    setSelected(id)
    surfaceRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const point = toDesignPoint(e.clientX, e.clientY)
    const x = Math.max(0, Math.min(CERT_CANVAS.width - 40, point.x - drag.current.dx))
    const y = Math.max(0, Math.min(CERT_CANVAS.height - 24, point.y - drag.current.dy))
    const id = drag.current.id
    if (id.startsWith('logo:')) {
      const logoId = id.slice(5)
      onChange({
        ...layout,
        logos: layout.logos.map((l) => (l.id === logoId ? { ...l, x, y } : l)),
      })
      return
    }
    onChange({
      ...layout,
      layers: layout.layers.map((l) => (l.id === id ? { ...l, x, y } : l)),
    })
  }

  const borderClass =
    layout.borderStyle === 'none'
      ? ''
      : layout.borderStyle === 'double'
        ? 'border-[6px] border-double'
        : layout.borderStyle === 'ornate'
          ? 'border-[10px] border-double'
          : 'border-4'

  return (
    <div className="space-y-3">
      <div ref={wrapRef} className="w-full min-w-0">
        <div
          className="relative mx-auto"
          style={{
            width: CERT_CANVAS.width * scale,
            height: CERT_CANVAS.height * scale,
            maxWidth: '100%',
          }}
        >
          <div
            ref={surfaceRef}
            className={`absolute left-0 top-0 origin-top-left overflow-hidden bg-white shadow-md ${borderClass}`}
            style={{
              width: CERT_CANVAS.width,
              height: CERT_CANVAS.height,
              transform: `scale(${scale})`,
              borderColor: layout.accentColor,
              background: layout.backgroundColor,
              touchAction: 'none',
            }}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
          >
            {layout.logos.map((logo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={logo.id}
                src={logo.src}
                alt=""
                className={`absolute cursor-move object-contain ${selected === `logo:${logo.id}` ? 'ring-2 ring-bhutan-yellow' : ''}`}
                style={{
                  left: logo.x,
                  top: logo.y,
                  width: logo.w,
                  height: logo.h,
                }}
                onPointerDown={(e) => onPointerDown(e, `logo:${logo.id}`, logo.x, logo.y)}
              />
            ))}
            {layout.layers.map((layer) => (
              <div
                key={layer.id}
                className={`absolute cursor-move overflow-hidden px-1 leading-tight ${selected === layer.id ? 'ring-2 ring-bhutan-yellow' : ''}`}
                style={{
                  left: layer.x,
                  top: layer.y,
                  width: layer.w,
                  height: layer.h,
                  color: layer.color,
                  fontSize: layer.fontSize || 16,
                  textAlign: layer.align || 'center',
                  fontWeight: layer.type === 'title' || layer.type === 'recipient' ? 700 : 500,
                }}
                onPointerDown={(e) => onPointerDown(e, layer.id, layer.x, layer.y)}
              >
                {layer.type === 'signature' && layout.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={layout.signatureUrl} alt="" className="mx-auto h-16 object-contain" />
                ) : (
                  resolveText(layer)
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Landscape preview scales to this panel. Drag logos, titles, and signatures to place them.
      </p>
      {selected && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Selected item</Label>
            <Input value={selected} readOnly className="min-h-11" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 self-end"
            onClick={() => {
              if (selected.startsWith('logo:')) {
                const id = selected.slice(5)
                onChange({ ...layout, logos: layout.logos.filter((l) => l.id !== id) })
              }
              setSelected(null)
            }}
          >
            Remove selected logo
          </Button>
        </div>
      )}
    </div>
  )
}
