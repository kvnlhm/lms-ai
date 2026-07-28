# ADR-003: PostgreSQL and Redis

## Status

Accepted.

## Context

LMS membutuhkan integritas relasional, transaksi progress yang kuat, cache, server-side session, rate limiting, dan asynchronous jobs.

## Decision

- PostgreSQL menjadi system of record.
- Redis digunakan untuk:
  - opaque web session;
  - cache;
  - rate limiting;
  - distributed lock;
  - BullMQ queue.

## Consequences

- Progress dan enrollment memiliki strong consistency.
- Analytics events dapat dimulai di PostgreSQL.
- BullMQ worker dapat di-scale independen.
- Session, cache, dan queue harus menggunakan key prefix terpisah.
- Saat beban meningkat, session/cache dan queue dapat dipindah ke Redis instance terpisah.
- Redis tidak boleh menjadi sumber kebenaran progress.
