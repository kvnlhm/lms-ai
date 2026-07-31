# Backup and Restore

## 1. Objectives

Target awal:

- Database RPO: 15 menit.
- Core service RTO: 60 menit.
- Object metadata RPO: 24 jam atau provider versioning.
- Audit dan backup harus berada pada failure domain berbeda dari server utama.

Target dapat ditingkatkan berdasarkan business impact dan budget.

---

## 2. Backup Scope

- PostgreSQL.
- Object storage metadata dan versioning.
- Infrastructure configuration.
- Encrypted secret recovery procedure.
- OpenAPI, Prisma schema, dan migration melalui Git.
- Critical operational documentation.

Redis:

- Session dapat hilang dan pengguna login ulang.
- Queue perlu persistence sesuai konfigurasi.
- Core progress tidak bergantung pada Redis sebagai source of truth.

---

## 3. PostgreSQL Strategy

Production:

- Point-in-time recovery jika provider mendukung.
- Daily snapshot.
- Weekly retained snapshot.
- Monthly retained snapshot sesuai policy.
- Backup encrypted at rest dan in transit.

Retention baseline:

```text
PITR: 7–14 hari
Daily: 14 hari
Weekly: 8 minggu
Monthly: 12 bulan
```

Retention final disesuaikan compliance dan biaya.

---

## 4. Object Storage

- Private bucket.
- Versioning untuk material penting.
- Lifecycle rule.
- Soft-delete window bila provider mendukung.
- Report export memiliki expiry.
- Malware/quarantine object mengikuti policy terpisah.

### Self-hosted video (ADR-014)

- Persistent video volume termasuk backup scope.
- Persistent avatar volume termasuk backup scope dan harus direstore bersama
  database agar referensi `user.avatar_url` tetap valid.
- Backup harus encrypted dan berada di failure domain berbeda dari VPS.
- Database dan video volume diambil dalam checkpoint yang dapat direkonsiliasi
  menggunakan `video_asset_id` dan object key.
- Minimal satu asset acak direstore dan diputar pada setiap restore drill.
- Snapshot Hostinger pada VPS yang sama bukan satu-satunya salinan backup.

---

## 4a. Implementasi Saat Ini

`scripts/backup.sh` mengambil satu checkpoint mandiri dan memangkas yang
kedaluwarsa. Pada VPS produksi skrip ini dipasang sebagai
`/usr/local/bin/lms-backup` (symlink ke checkout repo, supaya repo tetap
menjadi satu-satunya sumber kebenaran) dan dijalankan crontab root:

```cron
LMS_APP_UUID=<uuid resource Coolify>
30 18 * * * /usr/local/bin/lms-backup >> /var/backups/lms-ai/cron.log 2>&1
```

`LMS_APP_UUID` wajib diisi. Skrip memakainya untuk menemukan container
PostgreSQL, yang namanya berganti setiap deploy, dan berhenti dengan pesan
jelas bila nilainya kosong atau cocok ke lebih dari satu container. Nilainya
hanya ada pada crontab server, tidak di repository.

18:30 UTC setara 01:30 WIB. Hasilnya ada di `/var/backups/lms-ai/` dengan
tiga keranjang — `daily/`, `weekly/`, `monthly/` — sesuai retention baseline
§3. Weekly dan monthly berupa hardlink, jadi retensi panjang tidak memakan
ruang tambahan. Ukuran satu checkpoint saat ini 4,4 MB.

Isi tiap berkas `lms-<stempel>.tar`:

| Berkas | Isi |
|---|---|
| `database.dump` | `pg_dump --format=custom --no-owner` |
| `globals.sql` | definisi role, tanpa kata sandi |
| `video-data.tar.gz` | volume video self-hosted |
| `avatar-data.tar.gz` | volume foto profil |
| `course-thumbnail-data.tar.gz` | volume thumbnail kursus |
| `MANIFEST.txt` | versi migrasi terakhir dan jumlah baris tabel inti |
| `SHA256SUMS` | checksum seluruh berkas di atas |

Kata sandi role sengaja tidak disimpan. Saat restore, kata sandi diambil dari
environment variable Coolify (`POSTGRES_PASSWORD`), sehingga arsip yang bocor
tidak sekaligus membocorkan kredensial database.

### Yang belum terpenuhi

Dua hal pada §1 dan §4 belum tercapai dan masih menunggu keputusan tujuan
penyimpanan:

- **Offsite.** Seluruh salinan masih berada pada disk VPS yang sama dengan
  produksi — belum memenuhi syarat "failure domain berbeda". Kehilangan disk
  saat ini tetap berarti kehilangan backup.
- **Encryption at rest.** Arsip hanya dilindungi permission `0600`.

Keduanya sebaiknya diselesaikan bersamaan: enkripsi baru benar-benar berguna
ketika arsipnya meninggalkan server.

RPO nyata saat ini 24 jam, bukan 15 menit seperti target §1, karena belum ada
PITR/WAL archiving.

---

## 5. Restore Procedure

### Prosedur singkat dari satu checkpoint

Sudah dijalankan dan terbukti pada 31 Juli 2026 memakai checkpoint
`20260731T105134Z`, direstore ke container PostgreSQL 16 terpisah:

```bash
tar xf /var/backups/lms-ai/daily/lms-<stempel>.tar -C /tmp/pulih
cd /tmp/pulih && sha256sum -c SHA256SUMS       # arsip utuh

# Role lebih dulu; tanpa ini setiap GRANT gugur.
psql -U postgres -f globals.sql
createdb -U postgres lms
pg_restore -U postgres -d lms --no-owner database.dump

# Volume dipulihkan bersama database agar object_key tetap menunjuk file nyata.
tar xzf video-data.tar.gz -C /data/videos
tar xzf avatar-data.tar.gz -C /data/avatars
tar xzf course-thumbnail-data.tar.gz -C /data/course-thumbnails
```

Verifikasi: bandingkan jumlah baris terhadap `MANIFEST.txt`, pastikan
`_prisma_migrations` menunjuk migrasi yang sama, lalu cocokkan `object_key`
pada `video_assets` dengan daftar berkas di arsip volume.

Melewatkan `globals.sql` bukan galat yang mencolok — restore tetap terlihat
berhasil, tetapi setiap GRANT dibuang diam-diam.

### Prosedur lengkap untuk incident

1. Deklarasikan incident dan freeze perubahan.
2. Tentukan recovery point.
3. Provision database recovery environment.
4. Restore snapshot dan WAL/PITR.
5. Jalankan integrity check.
6. Verifikasi migration version.
7. Jalankan smoke test read-only.
8. Reconnect staging copy jika perlu.
9. Cut over production.
10. Verify login, course access, progress, dan queue.
11. Dokumentasikan data loss window.
12. Buat post-incident review.

---

## 6. Restore Drill

Minimal setiap tiga bulan:

- Restore database ke isolated environment.
- Verifikasi jumlah row utama.
- Verifikasi random enrollment dan progress.
- Verifikasi file sample.
- Jalankan critical E2E flow.
- Catat actual RPO dan RTO.
- Tutup gap yang ditemukan.

Backup dianggap belum valid sampai berhasil direstore.

---

## 7. Ownership

| Area | Owner |
|---|---|
| Backup configuration | DevOps Engineer |
| Database integrity | Database Engineer |
| Restore validation | QA Engineer |
| Security review | Security Reviewer |
| Business approval | Engineering Manager/Product Owner |
