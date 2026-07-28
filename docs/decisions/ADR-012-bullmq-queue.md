# ADR-012: BullMQ for Background Jobs

## Status

Accepted.

## Decision

Gunakan BullMQ dengan Redis untuk background processing.

## Queue Groups

- critical
- notifications
- analytics
- reports
- media
- ai
- maintenance

## Rules

- Core business transaction tidak dijalankan hanya melalui queue.
- Consumer harus idempotent.
- Retry hanya untuk error transient.
- Job menyimpan trace ID dan event ID.
- Failed job harus dapat diperiksa dan direplay.
- Queue age dan failure rate dimonitor.

## Consequences

- Worker dapat di-scale independen.
- Redis queue menjadi infrastructure dependency.
- Long-running job harus memiliki timeout dan cancellation strategy.
