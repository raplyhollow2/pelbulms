'use client'

import { PlatformAiConsole } from '@/components/ai/platform-ai-console'
import { SuperadminGate } from '@/components/admin/superadmin-gate'
import { CAP } from '@/lib/capability-keys'

export default function AdminAiPage() {
  return (
    <SuperadminGate anyOf={[CAP.AI_VIEW, CAP.AI_CONFIGURE, CAP.MODULE_PLATFORM_AI_VIEW]}>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold">AI</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Configure Claude, Gemini, ChatGPT, and Microsoft Copilot once. Everyone in the LMS uses these
          school-wide settings.
        </p>
        <PlatformAiConsole />
      </div>
    </SuperadminGate>
  )
}
