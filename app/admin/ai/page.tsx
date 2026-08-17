'use client'

import { GeminiKeySettings } from '@/components/ai/gemini-key-settings'

export default function AdminAiPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">AI platform keys</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Superadmins can save school-wide Gemini and avatar-video keys used when a teacher has not added their own.
      </p>
      <GeminiKeySettings platform />
    </div>
  )
}
