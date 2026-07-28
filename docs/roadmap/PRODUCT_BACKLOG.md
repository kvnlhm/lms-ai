# Product Backlog

## Conventions

Task ID:

```text
LMS-<EPIC>-<NUMBER>
```

Status:

- Planned.
- Ready.
- In Progress.
- Review.
- Done.
- Blocked.

## Epic 00 — Foundation

| ID | Task | Owner | Dependency | Acceptance |
|---|---|---|---|---|
| LMS-FND-001 | Initialise pnpm workspace dan Turborepo | DevOps | None | Apps dan packages terdeteksi |
| LMS-FND-002 | Create Next.js web app | Frontend | FND-001 | Health page berjalan |
| LMS-FND-003 | Create NestJS API | Backend | FND-001 | `/health/live` berjalan |
| LMS-FND-004 | Create NestJS worker | Worker | FND-001 | Worker terkoneksi Redis |
| LMS-FND-005 | Create FastAPI placeholder | AI | FND-001 | Health endpoint berjalan |
| LMS-FND-006 | Docker local stack | DevOps | FND-002–005 | Web, API, DB, Redis start |
| LMS-FND-007 | CI baseline | DevOps/QA | FND-001 | Lint, type, test, build |
| LMS-FND-008 | OpenTelemetry baseline | DevOps | FND-003–004 | Request dan job trace |

## Epic 01 — Identity and Access

| ID | Task | Owner | Dependency | Acceptance |
|---|---|---|---|---|
| LMS-ID-001 | Prisma user, role, permission schema | Database | Foundation | Migration lulus |
| LMS-ID-002 | Redis session infrastructure | Identity | ID-001 | Session create/revoke |
| LMS-ID-003 | Login dan logout API | Identity | ID-002 | Auth test lulus |
| LMS-ID-004 | CSRF protection | Identity/Security | ID-003 | CSRF test lulus |
| LMS-ID-005 | Password reset | Identity | ID-003 | Enumeration-safe |
| LMS-ID-006 | Master MFA | Identity | ID-003 | MFA wajib Master |
| LMS-ID-007 | Session device management | Identity | ID-002 | Own session revoke |
| LMS-ID-008 | Access control guard/policy | Identity | ID-001 | Deny by default |
| LMS-ID-009 | Login dan MFA UI | Frontend | ID-003–006 | All UI states |
| LMS-ID-010 | Security review | Security/QA | ID-001–009 | No Critical finding |

## Epic 02 — Learning Profile and Catalog

- Learning goal onboarding.
- Learning path CRUD.
- Course CRUD.
- Module CRUD dan ordering.
- Lesson CRUD dan ordering.
- Publishing validation.
- Media upload intent.
- Course builder UI.
- Catalogue UI.

## Epic 03 — Enrollment and Delivery

- Bulk enrollment.
- Access period.
- Course outline.
- Lesson access.
- Prerequisite.
- Signed material access.
- Continue learning.
- Enrollment expiry.

## Epic 04 — Progress

- Lesson open.
- Idempotent completion.
- Course progress.
- Course completion.
- Learning history.
- Outbox.
- Concurrency test.
- Reconciliation job.

## Epic 05 — Community

- Discussion.
- Reply.
- Reaction.
- Report.
- Moderation.
- Sanitisation.
- Rate limit.

## Epic 06 — Communication

- Announcement.
- Target audience.
- In-app notification.
- Email worker.
- Notification preference.

## Epic 07 — Analytics

- Event dictionary implementation.
- Raw event.
- Daily aggregates.
- Dashboard overview.
- Course analytics.
- Lesson analytics.
- Segment analytics.
- Risk score.
- Drop-off.
- Actionable insight.

## Epic 08 — Reporting and Audit

- CSV generation.
- Export job.
- Signed download.
- Audit viewer.
- CSV injection protection.

## Epic 09 — Hardening

- Load testing.
- Backup restore drill.
- Threat model review.
- Dependency upgrade.
- WAF.
- Incident simulation.
- Production readiness review.

## Task Template

```text
Task ID:
Objective:
Persona:
PRD reference:
In scope:
Out of scope:
Dependencies:
Owned files/modules:
Acceptance criteria:
Security considerations:
Tests:
Observability:
Definition of done:
Assigned agent:
Reviewer:
```

## Epic 10 — Bunny Stream Video

| ID | Task | Owner | Dependency | Acceptance |
|---|---|---|---|---|
| LMS-VID-001 | Define VideoProviderPort | Architect/Backend | Catalog | Provider-independent contract |
| LMS-VID-002 | Implement BunnyStreamAdapter | Backend | VID-001 | Create/read/delete provider video |
| LMS-VID-003 | Add video asset schema | Database | ERD | Migration and constraints pass |
| LMS-VID-004 | Implement direct upload intent | Backend | VID-002–003 | Authorised upload flow |
| LMS-VID-005 | Implement Bunny webhook | Backend/Security | VID-002–003 | Verified and idempotent |
| LMS-VID-006 | Implement playback session | Learning Backend | Enrollment | Access validated |
| LMS-VID-007 | Enable Token Authentication | Backend/DevOps | VID-006 | Short-lived URL |
| LMS-VID-008 | Configure Allowed Domains | DevOps | Deployment | Domains restricted |
| LMS-VID-009 | Enable MediaCage Basic DRM | DevOps/Backend | VID-002 | Protected stream |
| LMS-VID-010 | Add dynamic watermark | Frontend | VID-006 | Moving traceable watermark |
| LMS-VID-011 | Add playback heartbeat | Frontend/Backend | VID-006 | Session tracked |
| LMS-VID-012 | Add concurrent playback limit | Backend/Security | VID-011 | Policy enforced |
| LMS-VID-013 | Add video security tests | QA/Security | VID-004–012 | Critical tests pass |
| LMS-VID-014 | Add reconciliation job | Worker | VID-005 | Provider state reconciled |
