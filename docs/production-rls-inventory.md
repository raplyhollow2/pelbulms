# Live RLS inventory

Project: `lmspelbu` (`vtqqkexvwprettqnuhuk`). Read-only `pg_policies` check on 1 Oct 2026.

Migration [017_emergency_rls_fix.sql](../supabase/migrations/017_emergency_rls_fix.sql) still contains `USING (true)` writes. That is historical. Live policies match the later lock in [20261001153000_lock_authoring_and_quiz_rls.sql](../supabase/migrations/20261001153000_lock_authoring_and_quiz_rls.sql).

| Check | Live result |
| --- | --- |
| RLS enabled on courses, modules, lessons, profiles, quizzes, quiz_questions, quiz_attempts | Yes |
| Course insert | `instructor_id = auth.uid()` and `private.is_teaching_role` |
| Course update | `private.can_manage_course` |
| Course delete | Owner, or profile role admin or superadmin |
| Module and lesson writes | `private.can_manage_course` |
| Profile self-update | `WITH CHECK` freezes `role` and `account_status` |
| `profiles_enforce_privileges` trigger | Installed. Rejects those column changes unless the session user is `service_role`, `postgres`, `supabase_admin`, or `supabase_auth_admin` |
| `quiz_questions` learner select | Removed. Remaining select is staff via `private.can_manage_course` |
| `quiz_attempts` insert and update for `authenticated` and `anon` | Revoked |

## Residual

`quizzes_select` is still `USING (true)` for authenticated users. Quiz rows do not store answer keys. Keys are on `quiz_questions`, which learners cannot read. Scores are inserted by the service role from `POST /api/quizzes/[quizId]/attempts`.

`quiz_questions_manage` remains an authenticated `FOR ALL` policy for course staff, including `resource_person`. It does not grant learner reads.

Ad-hoc scripts such as `DISABLE_QUIZ_RLS.sql` are not the live state: RLS is enabled on the quiz tables.
