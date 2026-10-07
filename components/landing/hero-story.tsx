'use client'

import { useEffect, useState } from 'react'
import { BrandCharacter } from '@/components/brand/brand-character'
import { defaultHeroSlides, type HeroSlide } from '@/lib/landing-content'

const FALLBACK_TOPICS = ['Lessons', 'Practice', 'Certificates']
const CHIP_COLORS = ['#1e7a4c', '#e8b423', '#e25c14']

export function HeroStory({
  topics,
  slides,
  siteName,
}: {
  topics: string[]
  slides?: HeroSlide[]
  siteName: string
}) {
  const deck = slides?.length ? slides : defaultHeroSlides()
  const chips = (topics.length ? topics : FALLBACK_TOPICS).slice(0, 3)
  const [index, setIndex] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setIndex(0)
  }, [deck.length])

  useEffect(() => {
    if (reduced || deck.length < 2) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % deck.length), 3400)
    return () => window.clearInterval(timer)
  }, [reduced, deck.length])

  const slide = deck[reduced ? 0 : index] || deck[0]
  const listItems = slide.layout === 'courses' ? chips : slide.items.slice(0, 4)

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#12261c] text-[#fff9ec]">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(520px 360px at 78% 28%, rgba(232,180,35,0.22), transparent 70%), radial-gradient(420px 320px at 12% 88%, rgba(30,122,76,0.4), transparent 72%), linear-gradient(160deg, #1c140f 0%, #163526 48%, #120e0b 100%)',
        }}
      />
      <div className="relative flex h-full flex-col items-center justify-start gap-4 px-5 pb-6 pt-8 sm:pt-10 md:flex-row md:items-center md:justify-center md:gap-12 md:px-[6%] md:pt-6">
        <BrandCharacter pose="default" className="shrink-0" />
        <div key={`${index}-${slide.title}`} className="hero-slide-in w-full max-w-md md:w-[28rem]">
          {slide.kicker ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#e8b423] sm:text-xs">
              {siteName} · {slide.kicker}
            </p>
          ) : null}
          <h2 className="mt-2 text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
            {slide.title}
            {slide.accent ? <span className="mt-1 block text-[#e8b423]">{slide.accent}</span> : null}
          </h2>
          {slide.body ? <p className="mt-3 text-sm leading-snug text-[#fff9ec]/80 sm:text-base">{slide.body}</p> : null}
          <div className="mt-4">
            {slide.layout === 'courses' || slide.layout === 'list' ? (
              <ul className="space-y-2">
                {listItems.map((label, chip) => (
                  <li
                    key={`${label}-${chip}`}
                    className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2"
                  >
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg"
                      style={{ background: CHIP_COLORS[chip % CHIP_COLORS.length] }}
                    />
                    <span className="truncate text-sm font-semibold">{label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {slide.layout === 'steps' ? (
              <ol className="grid grid-cols-2 gap-2">
                {slide.items.slice(0, 4).map((step, stepIndex) => (
                  <li key={`${step}-${stepIndex}`} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold">
                    <span className="mr-2 text-[#e8b423]">{stepIndex + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
            {slide.layout === 'card' ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#fff9ec] px-4 py-3 text-[#2c221c]">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.16em] text-[#1e7a4c]">
                    {slide.items[0] || siteName}
                  </p>
                  <p className="text-sm font-bold">{slide.items[1] || slide.accent || slide.title}</p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e8b423] text-lg font-bold">★</span>
              </div>
            ) : null}
          </div>
          {deck.length > 1 ? (
            <div className="mt-4 flex gap-1.5">
              {deck.map((item, dot) => (
                <span
                  key={`${item.title}-${dot}`}
                  className={`h-1.5 rounded-full ${dot === (reduced ? 0 : index) ? 'w-6 bg-[#e8b423]' : 'w-1.5 bg-white/35'}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
