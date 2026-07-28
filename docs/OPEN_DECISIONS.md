# Open Decisions

Semua keputusan architecture yang diperlukan untuk mulai coding sudah dikunci.

Item berikut masih terbuka, tetapi **tidak memblokir repository foundation atau core feature development**.

| Decision | Default Abstraction | Dibutuhkan Sebelum |
|---|---|---|
| VPS/container provider | Docker-compatible host | Staging deployment |
| Managed PostgreSQL provider | Standard PostgreSQL connection | Production |
| Managed Redis provider | Standard Redis URL | Production scale |
| Object storage provider | S3-compatible adapter | Media staging |
| Video streaming provider | `VideoProviderPort` | Upload/playback production |
| Email provider | `EmailProviderPort` | Email notification production |
| Observability backend | OpenTelemetry exporter | Staging |
| Final domain | Environment variable | Staging |
| Branding/design system | Neutral token baseline | UI implementation |
| Data retention legal policy | Baseline in docs | Production launch |

Tidak ada pertanyaan teknis lain yang wajib dijawab untuk memulai Phase 0–4.

Keputusan vendor dipilih berdasarkan:

- Budget.
- Region.
- Data residency.
- SLA.
- Integration quality.
- Exit cost.
