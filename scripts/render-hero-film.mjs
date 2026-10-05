/**
 * Rigbu 10s hero film
 *
 * Story (loops seamlessly at 10.0s):
 *  0.0–3.3  Learn — Rigbu waves, course cards, "Advanced learning for Modern Bhutan"
 *  3.3–6.7  Guide — lesson path, "Guide every learner across the kingdom"
 *  6.7–10   Earn — certificate and gold seal, "Leave with proof"
 *  The last crossfade returns to Learn so frame 0 matches the loop point.
 *
 * Masters:
 *  desktop 1920×1080 H.264
 *  mobile  1080×1920 H.264
 *
 * Usage: node scripts/render-hero-film.mjs [--preview]
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const FPS = 30
const DURATION = 10
const FRAMES = FPS * DURATION
const root = path.resolve(import.meta.dirname, '..')
const scene = path.join(root, 'scripts', 'hero-film', 'scene.html')
const outDir = path.join(root, 'public', 'hero')
const previewOnly = process.argv.includes('--preview')

const variants = [
  { name: 'desktop', width: 1920, height: 1080, file: 'rigbu-hero-desktop' },
  { name: 'mobile', width: 1080, height: 1920, file: 'rigbu-hero-mobile' },
]

const previewTimes = [0]

function encode(framesDir, fileBase) {
  const mp4 = path.join(outDir, `${fileBase}.mp4`)
  const poster = path.join(outDir, `${fileBase}.jpg`)
  const pattern = path.join(framesDir, 'frame-%04d.png')
  const encode = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      pattern,
      '-c:v',
      'libx264',
      '-tune',
      'animation',
      '-preset',
      'medium',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '16',
      '-movflags',
      '+faststart',
      '-an',
      mp4,
    ],
    { stdio: 'inherit' }
  )
  if (encode.status !== 0) throw new Error(`ffmpeg encode failed for ${fileBase}`)
  const still = spawnSync(
    'ffmpeg',
    ['-y', '-i', mp4, '-frames:v', '1', '-update', '1', '-q:v', '2', poster],
    { stdio: 'inherit' }
  )
  if (still.status !== 0) throw new Error(`ffmpeg poster failed for ${fileBase}`)
}

async function shoot(page, variant, times, dest) {
  await page.setViewportSize({ width: variant.width, height: variant.height })
  const url = `${pathToFileURL(scene).href}?variant=${variant.name}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  fs.mkdirSync(dest, { recursive: true })
  for (let n = 0; n < times.length; n++) {
    const t = times[n]
    await page.evaluate((time) => window.renderAt(time), t)
    const name = previewOnly
      ? `${variant.name}-${String(t).replace('.', '_')}.png`
      : `frame-${String(n + 1).padStart(4, '0')}.png`
    await page.screenshot({ path: path.join(dest, name), type: 'png' })
    if (!previewOnly && n % 30 === 0) {
      console.log(`${variant.name} ${n}/${times.length}`)
    }
  }
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ deviceScaleFactor: 1 })
fs.mkdirSync(outDir, { recursive: true })

if (previewOnly) {
  const dest = path.join(root, 'scripts', 'hero-film', 'preview')
  fs.mkdirSync(dest, { recursive: true })
  for (const variant of variants) await shoot(page, variant, previewTimes, dest)
  console.log(`Preview frames in ${dest}`)
} else {
  const frameTimes = Array.from({ length: FRAMES }, (_, i) => i / FPS)
  for (const variant of variants) {
    const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), `rigbu-${variant.name}-`))
    try {
      await shoot(page, variant, frameTimes, framesDir)
      encode(framesDir, variant.file)
    } finally {
      fs.rmSync(framesDir, { recursive: true, force: true })
    }
  }
  fs.rmSync(path.join(root, 'scripts', 'hero-film', 'preview'), { recursive: true, force: true })
  console.log(`Wrote HD films to ${outDir}`)
}

await browser.close()
