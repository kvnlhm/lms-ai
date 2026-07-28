# ADR-008: FastAPI AI Service Boundary

## Status
Accepted.

## Decision
Use an optional Python FastAPI service only for AI workloads.

## Consequences
- AI ecosystem remains accessible.
- AI service cannot own permission, enrollment, progress, or completion.
- Inputs must be minimised and outputs validated.
