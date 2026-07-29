# ADR-013: Bunny Stream as Primary Video Provider

## Status

Accepted.

Pilihan provider utama untuk rollout awal diubah oleh ADR-014. Provider
abstraction dan Bunny Stream sebagai jalur migrasi tetap berlaku.

## Context

LMS membutuhkan video storage, transcoding, adaptive streaming, CDN delivery, tokenised playback, domain restriction, dan perlindungan terhadap downloader umum. Streaming melalui NestJS atau direct MP4 URL akan membebani server dan mudah diunduh.

## Decision

Bunny Stream dipilih sebagai video provider utama untuk MVP melalui:

```text
VideoProviderPort
└── BunnyStreamAdapter
```

Fitur yang digunakan:

- Direct upload.
- Automatic transcoding.
- Adaptive streaming.
- Token Authentication.
- Allowed Domains.
- MediaCage Basic DRM.
- Processing webhook.

## Security Controls

- Bunny API key hanya tersedia di NestJS backend.
- Playback dibuat setelah enrollment dan lesson access valid.
- Playback token memiliki masa berlaku pendek.
- Permanent playback URL tidak disimpan.
- Webhook diverifikasi dan replay-protected.
- Allowed Domains wajib aktif.
- Dynamic user watermark disediakan oleh LMS player.
- Concurrent playback dapat dibatasi.
- DRM tidak dianggap mampu mencegah screen recording sepenuhnya.

## Data Stored by LMS

PostgreSQL menyimpan internal video ID, lesson ID, provider, Bunny video ID, status, durasi, dimensi, DRM flag, thumbnail metadata, error, serta timestamps.

PostgreSQL tidak menyimpan Bunny API key, token authentication key, permanent playback token, DRM key, atau signed playback URL.

## Consequences

- Video tidak menggunakan bandwidth VPS.
- Bunny menjadi external dependency.
- Core API tetap menjadi authority untuk akses.
- Provider dapat diganti melalui adapter.
- Biaya mengikuti storage, delivery, dan optional enterprise DRM.

## Alternatives

- S3 direct MP4: ditolak karena mudah diunduh.
- YouTube unlisted: proteksi akses lemah.
- Cloudflare Stream: alternatif valid.
- AWS MediaPackage + DRM: terlalu kompleks untuk MVP.
