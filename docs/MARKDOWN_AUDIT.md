# Markdown File Audit

## Summary

- Total Markdown files: 55
- Placeholder documents remaining: 0
- Known stack contradictions remaining: 0
- Historical Laravel ADR: retained as `Superseded`
- Non-blocking vendor decisions: listed in `docs/OPEN_DECISIONS.md`

## Files

| File | Lines | Status |
|---|---:|---|
| `.claude/agents/ai-engineer.md` | 41 | Complete |
| `.claude/agents/backend-engineer.md` | 33 | Complete |
| `.claude/agents/community-backend-engineer.md` | 39 | Complete |
| `.claude/agents/database-engineer.md` | 38 | Complete |
| `.claude/agents/devops-engineer.md` | 36 | Complete |
| `.claude/agents/engineering-manager.md` | 33 | Complete |
| `.claude/agents/frontend-engineer.md` | 29 | Complete |
| `.claude/agents/identity-backend-engineer.md` | 46 | Complete |
| `.claude/agents/learning-analytics-engineer.md` | 30 | Complete |
| `.claude/agents/learning-backend-engineer.md` | 38 | Complete |
| `.claude/agents/product-manager.md` | 28 | Complete |
| `.claude/agents/qa-engineer.md` | 39 | Complete |
| `.claude/agents/security-reviewer.md` | 34 | Complete |
| `.claude/agents/software-architect.md` | 38 | Complete |
| `.claude/agents/technical-writer.md` | 27 | Complete |
| `.claude/agents/ui-ux-designer.md` | 35 | Complete |
| `.claude/agents/worker-engineer.md` | 41 | Complete |
| `AGENTS.md` | 81 | Complete |
| `CLAUDE.md` | 29 | Complete |
| `README.md` | 53 | Complete |
| `docs/DOCUMENTATION_INDEX.md` | 102 | Complete |
| `docs/DOCUMENTATION_STATUS.md` | 48 | Complete |
| `docs/GLOSSARY.md` | 34 | Complete |
| `docs/OPEN_DECISIONS.md` | 29 | Complete |
| `docs/PRD.md` | 2122 | Complete |
| `docs/analytics/EVENT_DICTIONARY.md` | 136 | Complete |
| `docs/api/API_CONTRACT.md` | 1200 | Complete |
| `docs/architecture/ARCHITECTURE.md` | 1352 | Complete |
| `docs/database/ERD.md` | 733 | Complete |
| `docs/decisions/ADR-001-modular-monolith.md` | 17 | Complete |
| `docs/decisions/ADR-002-laravel-react-inertia.md` | 26 | Historical/Superseded |
| `docs/decisions/ADR-003-postgresql-redis.md` | 28 | Complete |
| `docs/decisions/ADR-004-transactional-outbox.md` | 15 | Complete |
| `docs/decisions/ADR-005-cloud-agnostic-containers.md` | 13 | Complete |
| `docs/decisions/ADR-006-typescript-monorepo.md` | 12 | Complete |
| `docs/decisions/ADR-007-nestjs-modular-monolith.md` | 12 | Complete |
| `docs/decisions/ADR-008-fastapi-ai-boundary.md` | 12 | Complete |
| `docs/decisions/ADR-009-openapi-generated-client.md` | 12 | Complete |
| `docs/decisions/ADR-010-redis-opaque-session.md` | 34 | Complete |
| `docs/decisions/ADR-011-prisma-data-access.md` | 27 | Complete |
| `docs/decisions/ADR-012-bullmq-queue.md` | 34 | Complete |
| `docs/decisions/ADR-013-video-provider-abstraction.md` | 32 | Complete |
| `docs/decisions/README.md` | 35 | Complete |
| `docs/operations/BACKUP_RESTORE.md` | 108 | Complete |
| `docs/operations/DEPLOYMENT.md` | 170 | Complete |
| `docs/operations/ENVIRONMENT_VARIABLES.md` | 126 | Complete |
| `docs/operations/INCIDENT_RESPONSE.md` | 135 | Complete |
| `docs/roadmap/IMPLEMENTATION_ROADMAP.md` | 200 | Complete |
| `docs/roadmap/PRODUCT_BACKLOG.md` | 149 | Complete |
| `docs/security/ACCESS_CONTROL_MATRIX.md` | 75 | Complete |
| `docs/security/DATA_CLASSIFICATION.md` | 40 | Complete |
| `docs/security/SECURITY_CONTROLS.md` | 145 | Complete |
| `docs/security/THREAT_MODEL.md` | 147 | Complete |
| `docs/testing/DEFINITION_OF_DONE.md` | 74 | Complete |
| `docs/testing/TEST_PLAN.md` | 197 | Complete |

## Audit Rules Applied

- No active document may recommend Laravel.
- No active document may leave authentication ambiguous.
- Security, testing, backup, deployment, and incident response cannot remain placeholders.
- Short specialist agent files must include ownership and guardrails.
- Procurement choices may remain provider-agnostic when an adapter contract exists.
