# LMS Platform

Platform pembelajaran untuk:

- Business owner.
- Marketer.
- Coding learner.
- AI learner.
- Pencari kerja dan career switcher berbasis AI.

## Stack

- Next.js, React, TypeScript.
- NestJS, TypeScript.
- FastAPI untuk workload AI.
- PostgreSQL dan Prisma.
- Redis dan BullMQ.
- S3-compatible object storage.
- Docker.
- OpenAPI.
- OpenTelemetry.

## Architecture

Core LMS menggunakan NestJS modular monolith. Web, API, worker, dan AI service berada dalam satu monorepo tetapi dapat di-deploy dan di-scale secara independen.

## Start Here

1. `docs/DOCUMENTATION_INDEX.md`
2. `docs/PRD.md`
3. `docs/architecture/ARCHITECTURE.md`
4. `docs/database/ERD.md`
5. `docs/api/API_CONTRACT.md`
6. `docs/security/THREAT_MODEL.md`
7. `docs/testing/TEST_PLAN.md`
8. `docs/roadmap/PRODUCT_BACKLOG.md`
9. `AGENTS.md`

## Locked Decisions

- Single academy untuk MVP.
- Redis opaque session untuk web.
- REST `/api/v1`.
- PostgreSQL sebagai source of truth.
- BullMQ untuk background job.
- Transactional outbox.
- AI service terisolasi.
- Video melalui dedicated provider adapter.
- Docker Compose sebagai deployment awal.

## Current Repository Status

Repository ini adalah **documentation and agent template**. Source code scaffold, Prisma schema, OpenAPI machine file, Dockerfile, dan CI workflow dibuat pada Phase 0 implementation.
