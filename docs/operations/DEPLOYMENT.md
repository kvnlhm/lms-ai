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

### Akses administratif PostgreSQL

- PostgreSQL hanya dipublikasikan ke loopback VPS pada
  `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- Akses GUI seperti TablePlus wajib melewati SSH tunnel.
- Port PostgreSQL tidak ditambahkan ke firewall Hostinger atau UFW.
- Gunakan role database terpisah dengan hak minimum untuk pekerjaan CRUD;
  jangan memakai role aplikasi untuk penggunaan harian.

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

### 4a. Target akhir

Urutan di bawah adalah bentuk yang dituju, **belum seluruhnya berjalan**.
Yang belum ada: staging, promosi image yang sama antar-lingkungan, dan gerbang
approval. Dibiarkan tertulis sebagai sasaran, bukan sebagai deskripsi keadaan.

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

### 4b. Prosedur yang benar-benar dijalankan hari ini

Produksi memakai Coolify di satu VPS. Build terjadi di server itu juga, jadi
tidak ada image yang dipromosikan dari lingkungan lain.

**1. Pastikan commit sudah mendarat di origin.** Coolify membaca ref saat
dipicu, bukan saat antreannya jalan; memicu sebelum push selesai akan
membangun commit lama.

```bash
git log --oneline -1
git ls-remote origin <branch> | cut -c1-8   # harus sama
```

**2. Backup lebih dulu bila ada migrasi.**

```bash
LMS_APP_UUID=<uuid> LMS_ALERT_TO=<email> /usr/local/bin/lms-backup
```

Verifikasi checkpointnya, jangan hanya percaya bahwa perintahnya selesai:

```bash
tar xf /var/backups/lms-ai/daily/lms-<stempel>.tar -C /tmp/periksa
cd /tmp/periksa && sha256sum -c SHA256SUMS && head -12 MANIFEST.txt
```

`MANIFEST.txt` menyebut migrasi terakhir dan jumlah baris tabel inti. Catat
angkanya — itu yang dibandingkan setelah deploy.

**3. Picu deploy.**

```bash
docker exec coolify php artisan tinker --execute='
$app = App\Models\Application::where("uuid", "<uuid>")->firstOrFail();
$uuid = (string) new Visus\Cuid2\Cuid2();
queue_application_deployment(application: $app, deployment_uuid: $uuid, force_rebuild: false, is_api: false);
echo $uuid . PHP_EOL;
'
```

**4. Pantau sampai selesai.**

```bash
docker exec coolify-db psql -U coolify -d coolify -tAc \
  "SELECT status, substr(commit,1,8) FROM application_deployment_queues \
   WHERE deployment_uuid='<deployment_uuid>'"
```

**5. Verifikasi — jangan lewati langkah ini.**

```bash
LMS_APP_UUID=<uuid> /root/lms-ai/scripts/verify-deploy.sh
```

Status `finished` dari Coolify **tidak berarti deploy berhasil**. Ia hanya
berarti `docker compose up` selesai. Pada 31 Juli 2026 statusnya `finished`
sementara container API crash-loop dan situs membalas 503. `verify-deploy.sh`
memeriksa yang sebenarnya menentukan: keenam container berjalan dan tidak
`unhealthy`, situs membalas 200, `health/ready` melaporkan database dan Redis
terhubung, seluruh migrasi repo sudah terpasang, dan tidak ada galat baru
tercatat sejak API menyala.

Skripnya hanya membaca dan keluar dengan kode 1 bila ada yang tidak beres,
sehingga dapat dipakai sebagai gerbang.

**6. Bila gagal**, lihat log deployment lalu log container:

```bash
docker exec coolify-db psql -U coolify -d coolify -tAc \
  "SELECT logs FROM application_deployment_queues WHERE deployment_uuid='<uuid>'"
docker logs <container-yang-bermasalah> 2>&1 | tail -30
```

### 4c. Yang tidak tertangkap oleh test

Satu kelas kegagalan lolos dari typecheck, lint, seluruh test, dan build,
lalu baru muncul saat container produksi menyala: **mengimpor dependency
transitif**.

Di mesin pengembangan `node_modules` ter-hoist sehingga semuanya terjangkau.
Pada image produksi dengan layout pnpm yang ketat, paket hanya dapat mengimpor
apa yang tercantum di `dependencies` miliknya sendiri.

`import type` aman — hilang saat kompilasi. Yang berbahaya impor nilai.
Sebelum menambah impor di `apps/*`, periksa paketnya ada di `dependencies`
package.json paket itu, dan verifikasi pada hasil build:

```bash
grep -rn 'require("<paket>")' apps/api/dist/
```

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

## 9. Video Provider

Rollout awal dapat menggunakan mode `SELF_HOSTED` sesuai ADR-014:

```text
Nginx internal media location (tidak public secara langsung)
  └── read-only persistent video volume
        ↑
NestJS authorised streaming upload
```

Release blocker mode self-hosted:

- volume video tidak diekspos oleh container atau port terpisah;
- playback selalu melewati authorization API;
- HTTP Range terverifikasi;
- disk dan bandwidth alert aktif;
- backup encrypted ke lokasi di luar VPS berhasil dan restore sample diuji;
- hanya port SSH, HTTP, dan HTTPS yang dibuka pada Hostinger dan OS firewall.

## 10. Bunny Stream External Service

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
- Saat `VIDEO_PROVIDER=BUNNY_STREAM`, production video tidak disimpan di disk VPS.
- Provider health dimonitor sebagai non-core dependency.
- Core LMS tetap dapat dibuka ketika video provider unavailable.
