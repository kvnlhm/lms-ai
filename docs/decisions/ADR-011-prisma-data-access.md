# ADR-011: Prisma as Primary Data Access Layer

## Status

Accepted.

## Decision

Gunakan Prisma untuk schema, migration, transaction, dan type-safe query pada Core API.

## Guardrails

- Domain entity tidak bergantung pada Prisma type.
- Mapping dilakukan di infrastructure layer.
- Raw SQL diperbolehkan untuk query analytics kompleks yang:
  - terparameterisasi;
  - memiliki test;
  - didokumentasikan;
  - direview Database Engineer.
- Constraint database tetap menjadi lapisan perlindungan utama.
- Fitur PostgreSQL yang tidak didukung penuh oleh Prisma dapat ditambahkan melalui SQL migration.

## Consequences

- Produktivitas TypeScript meningkat.
- Migration perlu ditinjau sebelum production.
- Partial index dan advanced PostgreSQL feature mungkin membutuhkan SQL manual.
