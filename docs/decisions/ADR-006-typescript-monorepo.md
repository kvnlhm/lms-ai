# ADR-006: TypeScript Monorepo

## Status
Accepted.

## Decision
Use pnpm workspaces and Turborepo for Next.js, NestJS API, NestJS worker, and shared packages.

## Consequences
- Consistent tooling and types.
- Deployments remain independent.
- Folder ownership and dependency boundaries must be enforced.
