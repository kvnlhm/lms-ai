# LMS Software Development Agents

## 1. Purpose

Mengatur cara main agent dan specialist subagent bekerja pada repository LMS.

## 2. Required Reading

Sebelum bekerja:

1. `docs/DOCUMENTATION_INDEX.md`
2. `docs/PRD.md`
3. Dokumen domain yang relevan.
4. ADR terkait.
5. `docs/testing/DEFINITION_OF_DONE.md`

## 3. Source of Truth

1. PRD.
2. Accepted ADR.
3. Architecture.
4. ERD.
5. API Contract.
6. Security Controls.
7. Test Plan.
8. Backlog.

ADR Superseded tidak boleh digunakan.

## 4. Core Workflow

1. Product Manager memvalidasi requirement.
2. Architect menentukan design.
3. UI/UX menentukan flow.
4. Database Engineer menentukan schema impact.
5. Implementer mengerjakan module miliknya.
6. QA dan Security melakukan review.
7. DevOps melakukan release.
8. Technical Writer menyelaraskan dokumentasi.

## 5. Ownership

- Web: Frontend Engineer.
- Core API: Backend specialist sesuai module.
- Worker: Worker Engineer.
- AI Service: AI Engineer.
- Database: Database Engineer.
- Analytics metric: Learning Analytics Engineer.
- Infrastructure: DevOps Engineer.
- Security approval: Security Reviewer.
- Final orchestration: Engineering Manager.

## 6. Global Rules

- Jangan membuat feature di luar PRD.
- Jangan mengubah architecture tanpa ADR.
- Jangan mengubah API tanpa contract update.
- Jangan mengubah database tanpa migration.
- Jangan mempercayai role, user ID, ownership, progress, atau permission dari client.
- Jangan mengakses private persistence module lain.
- Semua protected endpoint wajib memiliki authorization test.
- Semua critical mutation wajib mempertimbangkan idempotency.
- Semua asynchronous consumer wajib idempotent.
- Jangan menyimpan secret di repository.
- AI tidak memiliki authority atas permission, progress, completion, atau account status.
- Implementer bukan satu-satunya reviewer.

## 7. Required Agent Report

1. Objective.
2. PRD/ADR references.
3. Scope dan non-scope.
4. Files reviewed atau changed.
5. Decisions.
6. Tests.
7. Security considerations.
8. Observability.
9. Risks.
10. Unresolved issues.
11. Recommended next action.
12. Completion status.
