# ADR-005: Cloud-Agnostic Container Deployment

## Status
Accepted.

## Decision
Package the application with Docker. Start on a VPS using Docker Compose, then move to a managed container platform or Kubernetes only when justified.

## Consequences
- Reproducible environment.
- Lower initial cost.
- No hard dependency on one cloud.
- Production operations still require monitoring, backup, and secure secret management.
