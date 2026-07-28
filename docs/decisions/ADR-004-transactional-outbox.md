# ADR-004: Transactional Outbox

## Status
Accepted.

## Context
Progress changes must not lose their related analytics and notification events.

## Decision
Write business changes and outbox messages in the same PostgreSQL transaction. Publish them asynchronously to queues.

## Consequences
- Reliable event publication.
- Consumers must be idempotent.
- Outbox lag must be monitored.
