# Pelbu LMS Auth & Enrollment Model

## Product model (current)

Pelbu uses **open account access** with **gated course enrollment**:

```
OAuth / passkey signup
  → profiles.account_status = active (instant)
  → Dashboard + /courses (browse catalog & details)
  → Click Enroll
  → enrollment pending (default) until course creator (or platform admin) approves
  → /learn access
```

This matches common free LMS practice (Moodle self-reg, Open edX, Canvas open courses): reduce signup friction, control who joins each course.

## Account status

| Status | Meaning |
|--------|---------|
| `active` | Default for new users. Full LMS browse access. |
| `rejected` / `suspended` | Hard block (abuse / moderation). Middleware sends to `/auth/access-denied`. |
| `pending` | Legacy. Migration `054` backfills pending → active. |

**KYC / `/auth/register` is optional.** Completing identity docs helps certificates and institutional records. Rejecting a KYC submission does **not** lock the LMS account.

## Enrollment modes (`courses.enrollment_mode`)

| Mode | Behavior |
|------|----------|
| `approval` (**default**) | Student request → `enrollments.status = pending` → creator/admin approves → `active` |
| `auto` | Immediate `active` enrollment |
| `invite_code` | Requires a unique invite code |
| `paid` | Stripe checkout (optional; free LMS does not rely on this) |

**Who approves:** course creator (`courses.instructor_id`) or platform `admin` / `superadmin`. Co-teachers can view the roster but cannot approve.

Key files:

- Middleware: `middleware.ts` (auth + rejected/suspended only)
- Auth callback: `app/auth/callback/route.ts` → `/dashboard`
- Enroll API: `app/api/enrollments/route.ts`
- Approve enrollments: `app/api/teach/enrollments/route.ts`
- Teacher queue: `app/teach/courses/[courseId]/students`
- Migration: `supabase/migrations/054_open_access_enrollment_approval.sql`

## Optional KYC flow

1. User may open `/auth/register` anytime (or skip).
2. After submit → `/auth/pending-approval` shows “profile under review” with **Continue to LMS**.
3. Admins review at `/admin/users?tab=approvals` for institutional metadata — not as a gate to enter the LMS.

## Historical note

Earlier revisions used a closed institutional gate (`account_status = pending` until admin KYC approval). That model blocked catalog access and hurt adoption for a free LMS. It was replaced by enrollment-only approval in migration `054`.
