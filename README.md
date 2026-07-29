# LMS Platform

Platform pembelajaran untuk:

- Business owner.
- Marketer.
- Coding learner.
- AI learner.
- Pencari kerja dan career switcher berbasis AI.

## Stack

- Next.js, React, TypeScript.
- NestJS, TypeScript.
- FastAPI untuk workload AI.
- PostgreSQL dan Prisma.
- Redis dan BullMQ.
- S3-compatible object storage.
- Docker.
- OpenAPI.
- OpenTelemetry.

## Architecture

Core LMS menggunakan NestJS modular monolith. Web, API, worker, dan AI service berada dalam satu monorepo tetapi dapat di-deploy dan di-scale secara independen.

## Start Here

1. `docs/DOCUMENTATION_INDEX.md`
2. `docs/PRD.md`
3. `docs/architecture/ARCHITECTURE.md`
4. `docs/database/ERD.md`
5. `docs/api/API_CONTRACT.md`
6. `docs/security/THREAT_MODEL.md`
7. `docs/testing/TEST_PLAN.md`
8. `docs/roadmap/PRODUCT_BACKLOG.md`
9. `AGENTS.md`

## Locked Decisions

- Single academy untuk MVP.
- Redis opaque session untuk web.
- REST `/api/v1`.
- PostgreSQL sebagai source of truth.
- BullMQ untuk background job.
- Transactional outbox.
- AI service terisolasi.
- Video melalui dedicated provider adapter.
- Docker Compose sebagai deployment awal.

## Menjalankan Secara Lokal

Prasyarat: Node.js 20.11+, pnpm 9, dan Docker.

```bash
cp .env.example .env
cp .env.example apps/api/.env

pnpm install
pnpm run infra:up      # PostgreSQL dan Redis
pnpm run db:migrate    # migration Prisma
pnpm run db:seed       # role, permission, akun contoh, dan katalog
pnpm run dev           # web di :3000, API di :3001
```

Dokumentasi OpenAPI interaktif tersedia di `http://localhost:3001/api/v1/docs`
selama `APP_ENV` bukan `production`.

### Akun contoh

Hanya untuk pengembangan lokal. Seed menolak berjalan ketika `APP_ENV` atau
`NODE_ENV` bernilai `production`.

| Peran | Email | Kata sandi |
|---|---|---|
| Master | `master@akademionline.id` | `Master#Lokal12345` |
| Pelajar | `pelajar@akademionline.id` | `Pelajar#Lokal12345` |

### Perintah yang sering dipakai

| Perintah | Kegunaan |
|---|---|
| `pnpm run typecheck` | TypeScript di seluruh workspace |
| `pnpm run test` | Unit test |
| `pnpm run test:e2e` | Test integrasi (butuh PostgreSQL dan Redis; hentikan worker lebih dulu) |
| `pnpm run openapi:generate` | Tulis ulang `openapi.json` dan client bertipe |
| `pnpm run openapi:check` | Gagal bila client tertinggal dari kontrak |
| `pnpm run db:reset` | Kosongkan database lalu migrasi dan seed ulang |

## Status Implementasi

Walking skeleton sudah berjalan ujung ke ujung: masuk, katalog, detail kursus,
membuka pelajaran, dan menandainya selesai sehingga progres kursus ikut naik.

### Sudah ada

**Fondasi**

- Monorepo pnpm dan Turborepo (`apps/web`, `apps/api`, `apps/worker`, `apps/ai`, `packages/*`).
- Skema Prisma untuk Core Identity, Learning Catalog, Enrollment and Progress,
  Transactional Outbox, `learning_events`, idempotency key, dan audit log.
- OpenAPI dengan skema respons lengkap (29 endpoint, 55 model) dan client
  TypeScript hasil generate.

**Autentikasi dan otorisasi**

- Session opaque di Redis pada cookie `HttpOnly`, CSRF double-submit, rate limit
  login per IP dan email, serta guard permission global.
- Verifikasi kata sandi tetap dijalankan untuk email yang tidak ada, sehingga
  durasi respons tidak mengungkap keberadaan akun.

**Sisi Pelajar**

- Katalog, enrollment milik sendiri, delivery kurikulum, dan penyelesaian
  pelajaran yang transaksional serta idempotent.
- Web Next.js: masuk, beranda, katalog, detail kursus, dan pemutar pelajaran,
  dengan mode terang dan gelap.

**Sisi Master**

- Kelola kursus: daftar termasuk draf dan arsip, buat, ubah, terbitkan,
  arsipkan, hapus.
- Kelola bagian dan pelajaran: tambah, ubah, hapus, ubah urutan.
- Kelola enrollment: daftar per kursus, beri akses massal dengan hasil per
  pengguna, ubah masa berlaku, cabut, aktifkan kembali.
- Setiap tindakan tercatat di audit log bersama `requestId`.
- Antarmuka web: daftar kursus dengan penyaring status, form kursus baru,
  editor bagian dan pelajaran (tambah, hapus, ubah urutan), penerbitan yang
  menampilkan seluruh alasan penolakan sekaligus, serta pengelolaan akses
  pelajar. Menu **Kelola** hanya muncul bagi pemegang `courses.manage`.

**Worker**

- Relay outbox memindahkan event ke BullMQ dengan `FOR UPDATE SKIP LOCKED`,
  backoff eksponensial, dan job ID deterministik.
- Konsumer analytics menulis `learning_events`; idempotensinya ditegakkan
  constraint unik `event_uuid`, bukan disiplin kode.

**Pengujian**

- 22 unit test, 75 test integrasi API, dan 7 test integrasi worker.
- Alur Master di browser diverifikasi manual: masuk, buat kursus, penolakan
  terbit, susun materi, terbitkan, kelola pelajar.

### Belum ada

Bagian berikut sudah didokumentasikan tetapi belum diimplementasikan, dan akan
ditambahkan lewat migration serta modul baru, bukan dengan mengubah yang sudah rilis:

- Pengelolaan pengguna oleh Master (buat, tangguhkan, aktifkan, reset MFA).
  Akibatnya pemberian akses kursus masih memakai ID pengguna, karena pencarian
  pelajar belum tersedia.
- Penyuntingan metadata kursus setelah dibuat, dan penyuntingan isi pelajaran;
  saat ini pelajaran hanya dapat ditambah, dihapus, dan diurutkan ulang.
- MFA, lupa kata sandi, dan pencabutan session pengguna lain oleh Master.
- Modul community, communication, analytics agregat, reporting, dan media.
- Pengiriman notifikasi sesungguhnya; konsumer saat ini hanya mencatat niat kirim.
- URL media bertanda tangan; pemutar video masih menampilkan status placeholder.
- Antrean `critical`, `reports`, `media`, dan `ai` belum memiliki konsumer.

Prototipe visual seluruh layar ada di `docs/prototype/ui-prototype.html`.

### Menjalankan worker

Worker berjalan terpisah dari API:

```bash
pnpm --filter @lms/worker run build
pnpm --filter @lms/worker run start
```

Tanpa worker, event tetap tersimpan aman di `outbox_messages` dan akan
diterbitkan begitu worker dinyalakan — itulah gunanya pola outbox.
