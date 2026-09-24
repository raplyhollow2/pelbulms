'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { RoleReportDashboard } from '@/components/reports/role-report-dashboard'
import { GradingAlertBanner } from '@/components/teach/grading-alert-banner'
import { ReportBlockCard, ReportHubHeader, ReportSectionTabs } from '@/components/reports/report-ui'
import type { ReportRange, ReportSectionPayload, ReportSnapshot } from '@/lib/reports/types'
import { canAccessAdmin } from '@/lib/roles'
import { createClient } from '@/lib/supabase/client'

export default function AdminReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string>('admin')
  const [range, setRange] = useState<ReportRange>('30d')
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null)
  const [deepDive, setDeepDive] = useState('')
  const [legacySections, setLegacySections] = useState<ReportSectionPayload[]>([])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const userRole = (profile as any)?.role || 'student'
      setRole(userRole)

      const isAdmin = canAccessAdmin(userRole)
      const isRp = userRole === 'resource_person'
      let allowed = isAdmin || isRp
      try {
        const capRes = await fetch('/api/admin/capabilities/me')
        if (capRes.ok) {
          const capJson = await capRes.json()
          const list: string[] = capJson.capabilities || []
          if (list.includes('*') || list.includes('admin.reports.view')) allowed = true
          else if (list.length > 0) allowed = false
        }
      } catch {
        // coarse role
      }
      if (!allowed) {
        router.push('/dashboard')
        return
      }

      const audience =
        userRole === 'superadmin'
          ? 'superadmin'
          : userRole === 'resource_person'
            ? 'resource_person'
            : 'admin'

      const res = await fetch(`/api/reports/snapshot?range=${range}&audience=${audience}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load snapshot')
      setSnapshot(json.snapshot)
      setLegacySections([])
      if (json.snapshot?.sections?.[0]?.section) {
        setDeepDive(json.snapshot.sections[0].section)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [range, router])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="container mx-auto flex items-center gap-2 px-4 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading command center…
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (!snapshot && legacySections.length > 0) {
    const current = legacySections.find((s) => s.section === deepDive) || legacySections[0]
    return (
      <div className="container mx-auto space-y-6 px-4 py-8">
        <ReportHubHeader
          title="Approvals reports"
          description="KYC queue health and institution quality for your scope."
          badges={['Resource person']}
        />
        <ReportSectionTabs
          sections={legacySections.map((s) => ({ id: s.section, title: s.title }))}
          active={current?.section || deepDive}
          onChange={setDeepDive}
        />
        <div className="space-y-4">
          {(current?.blocks || []).map((block) => (
            <ReportBlockCard key={block.id} block={block} />
          ))}
        </div>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="container mx-auto px-4 py-8 text-muted-foreground">No report data.</div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <GradingAlertBanner />
      <RoleReportDashboard
        snapshot={snapshot}
        range={range}
        onRangeChange={setRange}
        badge={
          role === 'superadmin'
            ? 'Superadmin'
            : role === 'resource_person'
              ? 'Resource person'
              : 'Admin'
        }
        showDeepDive
        deepDiveSection={deepDive}
        onDeepDiveChange={setDeepDive}
      />
    </div>
  )
}
