# ADR-002: Laravel with React and Inertia

## Status

Superseded by:

- `ADR-006-typescript-monorepo.md`
- `ADR-007-nestjs-modular-monolith.md`

## Context

Laravel pernah dipertimbangkan sebagai backend awal.

## Previous Decision

Menggunakan Laravel, PHP, React, dan Inertia.

## Reason for Supersession

Proyek memilih TypeScript end-to-end untuk web dan core backend:

- Next.js untuk web.
- NestJS untuk API dan worker.
- FastAPI hanya untuk workload AI.

Dokumen ini dipertahankan sebagai riwayat keputusan dan tidak boleh digunakan sebagai dasar implementasi baru.
