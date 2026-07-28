# Claude Code Instructions

Read `AGENTS.md` and `docs/DOCUMENTATION_INDEX.md` before working.

## Baseline

- Next.js web.
- NestJS modular monolith API.
- NestJS BullMQ worker.
- PostgreSQL and Prisma.
- Redis opaque session and queue.
- FastAPI AI boundary.
- OpenAPI generated client.
- Transactional outbox.

## Orchestration

The main agent:

- Defines scope.
- Chooses the smallest relevant specialist set.
- Delegates design before risky implementation.
- Prevents multiple agents editing the same files.
- Reconciles findings.
- Requires test evidence.
- Does not declare completion while Critical security findings remain.

Do not run every agent for every task.
Do not use superseded ADRs.
