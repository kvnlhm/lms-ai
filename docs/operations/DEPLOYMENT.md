# Deployment Guide

## 1. Approved Initial Topology

Deployment awal menggunakan Docker Compose pada VPS atau equivalent container host.

```text
CDN/WAF
  ↓
Nginx
  ├── Next.js Web
  ├── NestJS API
  └── Internal service routes

Docker workloads:
  ├── web
  ├── api
  ├── worker-critical
  ├── worker-notifications
  ├── worker-analytics
  ├── worker-reports
  ├── scheduler
  └── otel-collector optional

Data services:
  ├── PostgreSQL
  ├── Redis
  └── S3-compatible object storage
```

PostgreSQL dan Redis dapat berada pada VPS awal untuk development atau low-risk staging. Production disarankan menggunakan managed service atau instance terisolasi saat budget memungkinkan.

---

## 2. Domain Layout

Default:

```text
app.example.com    Next.js Web
api.example.com    NestJS API
assets.example.com CDN/Object Storage
```

Exact domain diisi melalui environment dan tidak memengaruhi architecture.

---

## 3. Deployment Environments

### Local

- Docker Compose.
- Local PostgreSQL.
- Local Redis.
- S3 emulator atau development bucket.
- Fake email provider.
- Synthetic data.

### Test

- Ephemeral PostgreSQL dan Redis.
- Migration dari database kosong.
- Tidak menghubungi provider production.

### Staging

- Topology menyerupai production.
- Separate database dan storage.
- Masked atau synthetic data.
- Email diarahkan ke sandbox.

### Production

- TLS.
- Private database dan Redis.
- Secret manager atau protected environment.
- Backup.
- Monitoring.
- WAF.
- Named administrator accounts.

---

## 4. Deployment Process

1. Merge ke protected branch.
2. CI menjalankan lint, type check, test, scan, dan build.
3. Build immutable image.
4. Deploy image yang sama ke staging.
5. Jalankan migration compatibility check.
6. Jalankan smoke test.
7. Approval production.
8. Backup checkpoint bila migration berisiko.
9. Deploy API dan worker yang backward-compatible.
10. Jalankan migration.
11. Deploy web.
12. Verify health, error rate, queue, dan business smoke test.
13. Rollback apabila gate gagal.

---

## 5. Database Migration

Gunakan expand-and-contract:

1. Tambah schema baru yang backward-compatible.
2. Deploy code yang mendukung schema lama dan baru.
3. Backfill.
4. Switch read/write.
5. Verifikasi.
6. Hapus schema lama pada release berbeda.

Destructive migration tidak boleh dilakukan bersamaan dengan code yang masih membutuhkan field lama.

---

## 6. Scaling

Scale web dan API berdasarkan:

- CPU.
- Memory.
- Request latency.
- Request rate.

Scale worker berdasarkan:

- Queue depth.
- Oldest job age.
- Processing duration.
- Failure rate.

Scale database setelah query, index, cache, dan connection pool ditinjau.

---

## 7. Rollback

Rollback aplikasi:

- Gunakan previous immutable image.
- Pastikan migration backward-compatible.

Rollback database:

- Gunakan migration rollback hanya bila aman.
- Untuk perubahan data besar, gunakan restore atau corrective migration.

Rollback feature:

- Gunakan feature flag untuk fitur berisiko.

---

## 8. Production Readiness Checklist

- DNS dan TLS aktif.
- CORS dan cookie domain benar.
- Secret production terpasang.
- Migration berhasil.
- Master MFA aktif.
- Backup berhasil.
- Restore pernah diuji.
- Storage private.
- Signed URL bekerja.
- Health check hijau.
- Queue worker aktif.
- Alert aktif.
- Error page production tidak membocorkan stack.

## 9. Bunny Stream External Service

```text
External Services
├── Bunny Stream video library
├── Bunny Stream CDN and player
├── S3-compatible storage for PDF and images
├── Email provider
└── Observability backend
```

Requirements:

- Bunny keys hanya diinjeksi ke API/worker.
- Webhook endpoint dapat diakses publik melalui HTTPS.
- Webhook memakai verification dan rate limit.
- Allowed Domains mencakup hostname staging dan production yang disetujui.
- Staging menggunakan library terpisah bila memungkinkan.
- Production video tidak disimpan di disk VPS.
- Provider health dimonitor sebagai non-core dependency.
- Core LMS tetap dapat dibuka ketika video provider unavailable.
