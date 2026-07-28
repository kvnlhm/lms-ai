# ADR-009: OpenAPI Generated Client

## Status
Accepted.

## Decision
Generate the web API client from the NestJS OpenAPI specification.

## Consequences
- Frontend does not guess API shapes.
- CI must detect stale clients and breaking changes.
- Backend entities are not shared directly with frontend.
