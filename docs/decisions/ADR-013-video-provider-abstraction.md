# ADR-013: Dedicated Video Streaming Provider through Adapter

## Status

Accepted.

## Context

Video tidak boleh diproses atau di-stream melalui NestJS karena akan membebani API server.

## Decision

Gunakan dedicated video streaming provider melalui `VideoProviderPort`.

Provider konkret dipilih saat procurement atau implementation.

## Required Capabilities

- Adaptive streaming.
- Signed playback access atau token.
- Upload API.
- Webhook processing.
- Playback status.
- Basic analytics.
- Domain restriction jika tersedia.

## Consequences

- Vendor dapat diganti tanpa mengubah domain.
- API hanya menyimpan provider ID dan metadata.
- Video authorization tetap diverifikasi Core API.
- Exact provider adalah keputusan procurement, bukan architecture blocker.
