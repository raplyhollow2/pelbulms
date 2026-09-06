# Pelbu LMS Auth & Enrollment Model

## Product model

Pelbu uses **two independent gates**, the same split used by Moodle (account confirmation + teacher enrolment) and Open edX photo ID verification:

```
OAuth / passkey signup
  → profiles.account_status = pending
  → Mandatory Bhutan KYC at /auth/register (CID + passport photo)
  → Student KYC approved by Resource Person / Admin / Superadmin
     → account_status = active, role = student
     → Browse catalog and request enrollment
     → Course creator (or platform admin) approves
     → /learn access
  → Instructor / Resource person KYC approved by Superadmin only
     → role = instructor | resource_person
     → /teach access
```

Courses are free. Approval is still mandatory: identity first, then course membership.

## Account status

| Status | Meaning |
|--------|---------|
| `pending` | Default for new users. KYC not yet approved. Middleware sends LMS routes to `/auth/register` or `/auth/pending-approval`. |
| `active` | Identity approved (or staff-provisioned). May browse and, with approved KYC, request enrollment. |
| `rejected` / `suspended` | Hard block. Middleware sends to `/auth/access-denied`. Rejected users may resubmit KYC. |

Existing accounts that were unlocked by migration `054` stay `active`. They must complete KYC before the **next enrollment**. Admin and Superadmin are exempt.

## KYC review

| Applicant | Who approves | Result |
|-----------|--------------|--------|
| Student | Resource Person, Admin, assigned reviewer, or Superadmin | `role = student`, account active |
| Instructor / Resource person | **Superadmin only** | Teaching role; `/teach` unlocks |
| Teaching reject | Superadmin | Does **not** strip an already-active student account |

UI: `/admin/users?tab=approvals` — **Student identity** vs **Teaching applications**.

## Enrollment modes (`courses.enrollment_mode`)

| Mode | Behavior |
|------|----------|
| `approval` (**default**) | Student request → `enrollments.status = pending` → creator/admin approves → `active` |
| `invite_code` | Requires a unique invite code (private cohorts) |
| `auto` | Immediate `active` — not recommended for free courses |
| `paid` | Stripe checkout (unused for the free catalog) |

**Who approves enrollment:** course creator (`courses.instructor_id`) or platform `admin` / `superadmin`. Co-teachers can view the roster but cannot approve.

Enroll API requires `account_status = active` **and** an approved `student_registrations` row (admin/superadmin exempt).

Key files:

- Middleware: `middleware.ts`
- Auth callback: `app/auth/callback/route.ts`
- KYC form: `app/auth/register/page.tsx`
- Enroll API: `app/api/enrollments/route.ts`
- Approve enrollments: `app/api/teach/enrollments/route.ts`
- KYC review: `lib/approve-registration.ts`, `app/api/admin/approvals/route.ts`
- Teacher queue: `app/teach/courses/[courseId]/students`
- Migration: `supabase/migrations/055_mandatory_kyc_enrollment_approval.sql`

## Historical note

Migration `054` made KYC optional so catalog access was instant. That is reversed here: free courses still need identity verification and creator enrollment approval. `auth1.md` describes the older closed-gate security review.
