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

### Peringatan kegagalan

`LMS_ALERT_TO` menentukan penerima. Kegagalan mengirim satu email lewat Resend;
keberhasilan sengaja tidak mengirim apa pun, karena surat rutin yang selalu
datang justru melatih orang mengabaikannya.

Kunci Resend dibaca langsung dari environment container API yang sedang
berjalan, jadi tidak ada salinan rahasia tambahan di crontab atau berkas lain,
dan rotasi kunci otomatis terikut.

Jalurnya dapat diuji kapan saja tanpa merusak backup lebih dulu:

```bash
LMS_APP_UUID=<uuid> LMS_ALERT_TO=<email> /usr/local/bin/lms-backup --test-alert
```

Satu kegagalan menghasilkan tepat satu surat. Penjaganya berupa berkas
penanda, bukan variabel, karena `die` kerap dipanggil dari dalam command
substitution yang berjalan di subshell — variabel apa pun yang diset di sana
lenyap, lalu trap `ERR` di shell induk ikut menyala dan mengirim surat kedua
untuk kegagalan yang sama.

### Yang tidak tercakup peringatan ini

Bila cron sendiri tidak pernah menyala — daemonnya mati, atau servernya mati —
skripnya tidak berjalan sama sekali sehingga tidak ada yang mengirim
peringatan. Lubang itu ditutup dari sisi lain: Coolify memantau server tidak
terjangkau dan penggunaan disk, dan mengirimnya lewat Resend ke alamat yang
sama.

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

- **Encryption at rest.** Arsip hanya dilindungi permission `0600` di server,
  dan mengandalkan enkripsi sisi penyedia setelah diunggah. Arsipnya sendiri
  belum dienkripsi sebelum meninggalkan server, sehingga siapa pun yang dapat
  membaca keranjang objek dapat membaca isinya.

## 4b. Salinan di Luar Server

Setiap checkpoint diunggah ke penyimpanan objek S3-compatible segera setelah
salinan lokalnya utuh dan terpangkas. Dirancang untuk Cloudflare R2, tetapi
tidak terikat padanya — konfigurasinya hanya endpoint, bucket, dan sepasang
kunci.

Urutannya disengaja: unggahan berjalan **setelah** checkpoint lokal selesai.
Bila unggahannya gagal, yang di server tetap ada dan sah; yang hilang hanya
salinan keduanya, dan itulah yang dikatakan pesan peringatannya.

**Verifikasi.** Setelah diunggah, ukurannya dibandingkan, lalu objeknya
diunduh kembali dan di-sha256 terhadap berkas lokal. Ukuran yang cocok hanya
membuktikan sesuatu sampai di sana, bukan bahwa isinya sama. Untuk arsip yang
sudah terlalu besar untuk diunduh setiap malam, `LMS_OFFSITE_VERIFY=ukuran`
membatasi pemeriksaan pada jumlah byte saja — dengan konsekuensi yang harus
disadari.

**Retensi** dijalankan setelah unggahan berhasil, bukan sebelumnya. Memangkas
lebih dulu akan mengurangi jumlah salinan justru pada malam ketika unggahannya
gagal.

**Kredensial** tidak pernah masuk repository ini, yang bersifat publik. Cron
memuatnya dari `/etc/lms-backup.env` dengan permission `600`. Selama keempat
nilainya kosong, backup tetap berjalan normal dan hanya mencatat bahwa salinan
offsite dilewati.

| Variabel | Isi |
|---|---|
| `LMS_S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `LMS_S3_BUCKET` | Nama bucket |
| `LMS_S3_ACCESS_KEY_ID` | Access Key ID token R2 |
| `LMS_S3_SECRET_ACCESS_KEY` | Secret Access Key token R2 |
| `LMS_S3_REGION` | `auto` untuk R2 |
| `LMS_OFFSITE_KEEP` | Jumlah checkpoint yang disimpan di luar server |

`backup.sh --test-offsite` menulis, membaca, lalu menghapus satu berkas kecil
untuk membuktikan kredensial, jangkauan jaringan, dan izin hapus — tanpa
menunggu backup malam dan tanpa mengotori keranjang.

rclone dijalankan di dalam container, jadi VPS tidak perlu memasangnya.
Rahasianya diteruskan lewat `-e NAMA` tanpa nilai, sehingga tidak pernah muncul
pada baris perintah yang dapat dibaca `ps`.

RPO nyata saat ini 24 jam, bukan 15 menit seperti target §1, karena belum ada
PITR/WAL archiving. Salinan di luar server tidak mengubah angka itu — ia
menutup syarat "failure domain berbeda" pada §1, bukan jarak antar-checkpoint.

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
