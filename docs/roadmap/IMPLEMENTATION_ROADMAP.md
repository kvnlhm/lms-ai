# Technical Implementation Roadmap

## LMS v1

---

## Phase 0 — Repository Foundation

Output:

- pnpm workspace.
- Turborepo.
- Next.js app.
- NestJS API.
- NestJS worker.
- FastAPI service skeleton dengan health endpoint dan contract boundary.
- Docker local environment.
- PostgreSQL dan Redis.
- Shared lint, TypeScript, testing config.
- CI baseline.
- OpenTelemetry baseline.

Definition of done:

- Semua app dapat dijalankan lokal.
- Health check berhasil.
- CI lint, type check, dan test berhasil.
- Tidak ada secret pada repository.

---

## Phase 1 — Identity and Access

Scope:

- User.
- Role.
- Permission.
- Login.
- Refresh session.
- Logout.
- Forgot password.
- MFA Master.
- Session management.
- Audit login dan privileged action.

Subagent:

- Identity backend.
- Database engineer.
- Security reviewer.
- QA.

---

## Phase 2 — Learning Profile and Catalog

Scope:

- Learning goal onboarding.
- Learning path.
- Course.
- Module.
- Lesson.
- Media upload.
- Publishing workflow.

Subagent:

- Product.
- UI/UX.
- Catalog backend.
- Frontend.
- Media.
- QA.

---

## Phase 3 — Enrollment and Learning Delivery

Scope:

- Enrollment.
- Access period.
- Course outline Pelajar.
- Lesson access.
- Prerequisite.
- Continue learning.

---

## Phase 4 — Progress

Scope:

- Lesson open.
- Lesson complete.
- Course progress.
- Completion.
- Learning history.
- Transactional outbox.
- Idempotency.

Release blocker:

- Progress concurrency test.
- IDOR test.
- Outbox reliability test.

---

## Phase 5 — Community

Scope:

- Discussion.
- Reply.
- Reaction.
- Report.
- Moderation.
- Best answer.

---

## Phase 6 — Communication

Scope:

- Announcement.
- In-app notification.
- Notification preference.
- Email worker.

---

## Phase 7 — Analytics

Scope:

- Event taxonomy.
- Raw learning event.
- Daily aggregate.
- Master dashboard.
- Course analytics.
- Lesson analytics.
- Segment analytics.
- Risk score.
- Drop-off.

---

## Phase 8 — Reporting and Audit

Scope:

- CSV export.
- Asynchronous report.
- Signed download.
- Audit log viewer.
- Export audit.

---

## Phase 9 — AI Features

AI service baru diaktifkan setelah core LMS stabil.

Candidate:

- Learning path recommendation.
- Skill-gap analysis.
- AI tutor.
- Forum summary.
- Job role matching.
- CV analysis.

Setiap feature membutuhkan:

- Data minimisation.
- Prompt/model version.
- Output validation.
- Human override.
- Cost limit.
- Evaluation set.
- Failure fallback.

---

## Phase 10 — Scale and Hardening

- Load test.
- Read replica.
- Dedicated Redis topology.
- Queue autoscaling.
- Event partitioning.
- Backup restore drill.
- Incident simulation.
- WAF.
- Advanced observability.
- Dependency upgrade process.
