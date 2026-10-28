/**
 * Unit tests for Course Insights org-scope helpers.
 * Run: npx --yes tsx --test lib/reports/teach-org-scope.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  filterEnrollmentsByLearnerHomeOrg,
  filterRowsByUserIds,
  unionInstitutionIds,
} from './teach-org-scope'

describe('unionInstitutionIds', () => {
  it('unions audience and learner home orgs without duplicates', () => {
    assert.deepEqual(
      unionInstitutionIds(['pelsung', 'rtc'], ['rtc', 'org-c', null, undefined], []),
      ['pelsung', 'rtc', 'org-c']
    )
  })

  it('returns empty when no ids', () => {
    assert.deepEqual(unionInstitutionIds([null], []), [])
  })
})

describe('filterEnrollmentsByLearnerHomeOrg', () => {
  const enrollments = [
    { id: 'e1', user_id: 'u1', course_id: 'c1' },
    { id: 'e2', user_id: 'u2', course_id: 'c1' },
    { id: 'e3', user_id: 'u3', course_id: 'c1' },
    { id: 'e4', user_id: null, course_id: 'c1' },
  ]
  const homeOrgByUser = new Map<string, string | null>([
    ['u1', 'pelsung'],
    ['u2', 'rtc'],
    ['u3', 'pelsung'],
  ])

  it('keeps only enrollments whose learner home org matches', () => {
    const filtered = filterEnrollmentsByLearnerHomeOrg(enrollments, homeOrgByUser, 'pelsung')
    assert.deepEqual(
      filtered.map((e) => e.id),
      ['e1', 'e3']
    )
  })

  it('excludes learners with missing or other home orgs', () => {
    const filtered = filterEnrollmentsByLearnerHomeOrg(enrollments, homeOrgByUser, 'rtc')
    assert.deepEqual(
      filtered.map((e) => e.id),
      ['e2']
    )
  })

  it('returns empty when no learners match the selected org', () => {
    const filtered = filterEnrollmentsByLearnerHomeOrg(enrollments, homeOrgByUser, 'unknown')
    assert.deepEqual(filtered, [])
  })
})

describe('filterRowsByUserIds', () => {
  it('keeps progress rows for remaining enrolled users', () => {
    const rows = [
      { user_id: 'u1', lesson_id: 'l1' },
      { user_id: 'u2', lesson_id: 'l1' },
      { user_id: 'u3', lesson_id: 'l2' },
    ]
    const allowed = new Set(['u1', 'u3'])
    assert.deepEqual(filterRowsByUserIds(rows, allowed), [
      { user_id: 'u1', lesson_id: 'l1' },
      { user_id: 'u3', lesson_id: 'l2' },
    ])
  })
})

describe('teach audience org semantics (documented expectations)', () => {
  it('approval-only org without enrollments or course link is not implied by union of homes+audience', () => {
    // Simulates Course Insights list: only homes ∪ course_institutions — not getApprovalScope.
    const homes = ['pelsung', 'org-c']
    const audience = ['pelsung']
    const approvalOnly = 'rtc'
    const teachOrgs = new Set(unionInstitutionIds(homes, audience))
    assert.equal(teachOrgs.has(approvalOnly), false)
    assert.equal(teachOrgs.has('pelsung'), true)
    assert.equal(teachOrgs.has('org-c'), true)
  })
})
