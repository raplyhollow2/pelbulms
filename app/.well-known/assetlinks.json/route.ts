import { NextResponse } from 'next/server'

function fingerprints(): string[] {
  const raw = [
    process.env.ANDROID_CERT_SHA256,
    process.env.ANDROID_DEBUG_CERT_SHA256,
  ].filter((value): value is string => Boolean(value?.trim()))

  return raw.map((value) => {
    const hex = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
    if (hex.length !== 64) return value.trim().toUpperCase()
    return hex.match(/.{2}/g)?.join(':') ?? value
  })
}

export async function GET() {
  const sha256 = fingerprints()
  if (!sha256.length) {
    return NextResponse.json([], {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    })
  }

  const statements = sha256.map((fingerprint) => ({
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'bt.pelbu.lms',
      sha256_cert_fingerprints: [fingerprint],
    },
  }))

  return NextResponse.json(statements, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
