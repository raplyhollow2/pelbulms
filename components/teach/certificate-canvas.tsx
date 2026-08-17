'use client'

import { useRef, useState } from 'react'
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
  const [selected, setSelected] = useState<string | null>(null)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)

  const scale = 0.62
  const resolveText = (layer: CertificateLayer) => {
    const raw = layer.text || ''
    return raw
      .replace('{{recipient}}', sampleName)
      .replace('{{course}}', sampleCourse)
      .replace('{{date}}', new Date().toLocaleDateString())
      .replace('{{code}}', 'CERT-PREVIEW')
  }

  const onPointerDown = (e: React.PointerEvent, id: string, x: number, y: number) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    drag.current = {
      id,
      dx: (e.clientX - rect.left) / scale - x,
      dy: (e.clientY - rect.top) / scale - y,
    }
    setSelected(id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const parent = e.currentTarget as HTMLElement
    const rect = parent.getBoundingClientRect()
    const x = Math.max(0, (e.clientX - rect.left) / scale - drag.current.dx)
    const y = Math.max(0, (e.clientY - rect.top) / scale - drag.current.dy)
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
      <div
        className={`relative overflow-hidden rounded-md bg-white shadow-md ${borderClass}`}
        style={{
          width: CERT_CANVAS.width * scale,
          height: CERT_CANVAS.height * scale,
          maxWidth: '100%',
          borderColor: layout.accentColor,
          background: layout.backgroundColor,
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
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
              left: logo.x * scale,
              top: logo.y * scale,
              width: logo.w * scale,
              height: logo.h * scale,
            }}
            onPointerDown={(e) => onPointerDown(e, `logo:${logo.id}`, logo.x, logo.y)}
          />
        ))}
        {layout.layers.map((layer) => (
          <div
            key={layer.id}
            className={`absolute cursor-move px-1 ${selected === layer.id ? 'ring-2 ring-bhutan-yellow' : ''}`}
            style={{
              left: layer.x * scale,
              top: layer.y * scale,
              width: layer.w * scale,
              height: layer.h * scale,
              color: layer.color,
              fontSize: (layer.fontSize || 16) * scale,
              textAlign: layer.align || 'center',
              fontWeight: layer.type === 'title' || layer.type === 'recipient' ? 700 : 500,
            }}
            onPointerDown={(e) => onPointerDown(e, layer.id, layer.x, layer.y)}
          >
            {layer.type === 'signature' && layout.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layout.signatureUrl} alt="" className="mx-auto h-12 object-contain" />
            ) : (
              resolveText(layer)
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Drag logos, titles, and signatures to place them.</p>
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
