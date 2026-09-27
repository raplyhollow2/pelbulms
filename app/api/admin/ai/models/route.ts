import { NextResponse } from 'next/server'

/** Replaced by /api/admin/ai/providers and /api/admin/ai/routes. */
export async function PATCH() {
  return NextResponse.json(
    { error: 'Model defaults moved. Assign providers under Admin → AI.' },
    { status: 410 }
  )
}
