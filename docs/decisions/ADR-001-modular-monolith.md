# ADR-001: Use Modular Monolith

## Status
Accepted.

## Context
The LMS requires high scalability and maintainability, but the initial team and deployment platform are not yet fixed.

## Decision
Use a modular monolith with strict domain boundaries and asynchronous processing.

## Consequences
- Lower operational complexity.
- Strong transaction support.
- Easier refactoring.
- Modules must be protected by architecture tests.
- Service extraction remains possible through contracts and events.
