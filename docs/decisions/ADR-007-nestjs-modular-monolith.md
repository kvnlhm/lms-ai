# ADR-007: NestJS Modular Monolith

## Status
Accepted.

## Decision
Use NestJS modular monolith for the core LMS.

## Consequences
- Strong transactional boundary for enrollment and progress.
- Lower operational complexity than microservices.
- Architecture tests are required to protect module boundaries.
