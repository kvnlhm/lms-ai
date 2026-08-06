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

**Retensi harian lokal yang berlaku sejak 6 Agustus 2026: 2 checkpoint**, bukan
14 hari seperti baseline di atas. Keputusan pemilik, atas dasar bahwa kedalaman
pemulihan yang sesungguhnya berada di salinan offsite — `LMS_OFFSITE_KEEP=30`
checkpoint di Cloudflare R2, pada failure domain yang berbeda dari VPS ini.
Keranjang lokal hanya melayani pemulihan cepat tanpa perlu mengunduh apa pun.

Konsekuensinya harus disadari sebelum dibutuhkan: kerusakan data yang baru
ketahuan lebih dari dua hari setelah terjadi tidak lagi ada di disk ini, dan
harus diambil dari R2. Jalur itu karenanya berhenti menjadi cadangan kedua dan
menjadi satu-satunya cadangan untuk rentang di luar dua hari — kegagalan
unggahan offsite kini jauh lebih serius daripada sebelumnya, dan peringatannya
tidak boleh diabaikan.

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
  **Penyimpangan yang disengaja sejak 6 Agustus 2026:** volume ini tidak lagi
  ikut dicadangkan. Lihat "Pengecualian video-data" di §4a untuk alasan,
  konsekuensi, dan syaratnya. Baris ini sengaja dibiarkan utuh: yang berubah
  adalah praktiknya, bukan apa yang diminta ADR-014, dan penyimpangan yang
  menghapus jejak persyaratan aslinya berhenti terbaca sebagai penyimpangan.
- Persistent avatar volume termasuk backup scope dan harus direstore bersama
  database agar referensi `user.avatar_url` tetap valid.
- Persistent community attachment volume termasuk backup scope dan harus
  direstore bersama tabel `community_post_attachments`.
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
tiga keranjang — `daily/`, `weekly/`, `monthly/`. `daily/` menyimpan 2
checkpoint terakhir (lihat §3); weekly dan monthly berupa hardlink, jadi
retensi panjang tidak memakan ruang tambahan. Ukuran satu checkpoint saat ini
24 MB, sehingga menyimpan riwayat bulanan praktis tidak berbiaya.

Isi tiap berkas `lms-<stempel>.tar`:

| Berkas | Isi |
|---|---|
| `database.dump` | `pg_dump --format=custom --no-owner` |
| `globals.sql` | definisi role, tanpa kata sandi |
| `avatar-data.tar.gz` | volume foto profil |
| `course-thumbnail-data.tar.gz` | volume thumbnail kursus |
| `material-data.tar.gz` | volume materi kursus |
| `MANIFEST.txt` | versi migrasi, jumlah baris, dan volume yang dikecualikan |
| `SHA256SUMS` | checksum seluruh berkas di atas |

### Pengecualian video-data

`video-data.tar.gz` **tidak lagi ada di dalam arsip.** Sampai 6 Agustus 2026
volume video ikut dikemas utuh setiap malam. Volumenya 3,3 GB dan nyaris tidak
berubah, sementara `database.dump` hanya 350 KB — sehingga satu checkpoint
menjadi 3,2 GB dan retensi 14 checkpoint memakan 45 GB. Malam itu disk 96 GB
benar-benar penuh dan backup 18:30 gagal pada langkah pengarsipan video:
cadangan yang menghabiskan disknya sendiri berhenti menjadi cadangan.

Berkas master video disimpan pemilik di luar server, jadi VPS ini tidak perlu
menjadi tempat penyimpanan keduanya.

**Syarat yang membuat keputusan ini tetap aman:**

- Salinan master di luar server harus benar-benar ada dan diperbarui ketika
  video baru diunggah. Tidak ada yang memeriksa ini secara otomatis; inilah
  satu-satunya titik yang bergantung sepenuhnya pada disiplin manusia.
- Salinan itu sebaiknya tidak tunggal. Satu disk pribadi tanpa checksum dan
  tanpa versi adalah satu kegagalan perangkat keras dari kehilangan permanen.

**Konsekuensi saat restore.** `database.dump` tetap memulihkan seluruh baris
`video_assets` beserta object key-nya, sehingga katalog, kurikulum, dan progres
belajar kembali utuh. Yang tidak kembali adalah berkas videonya; sampai berkas
itu diunggah ulang dari salinan master, object key menunjuk ke berkas yang
belum ada dan pemutaran gagal. Setiap MANIFEST mencantumkan
`volume_tidak_dicadangkan` supaya kenyataan ini terbaca sebelum restore
dimulai, bukan sesudahnya.

Mengembalikan perilaku lama cukup dengan memindahkan `video-data` dari
`EXCLUDED_VOLUMES` ke `VOLUMES` di `scripts/backup.sh`, dan menyediakan disk
untuk menampungnya.

### Satu checkpoint per hari

Keranjang harian menyimpan `DAILY_KEEP` checkpoint, bukan `DAILY_KEEP` hari.
Pada 6 Agustus 2026 skrip dijalankan manual lima kali dalam sehari, sehingga
14 slot yang dimaksudkan menutup dua minggu hanya menutup tiga hari — riwayat
menyusut diam-diam justru karena backup dijalankan lebih sering.

Skrip kini melewati checkpoint kedua pada hari yang sama. Penjaganya melihat
berkas di `daily/`, dan berkas itu hanya muncul setelah checkpoint selesai
utuh, sehingga percobaan ulang setelah kegagalan tetap diizinkan. Gunakan
`lms-backup --force` bila memang perlu checkpoint tambahan.

Kata sandi role sengaja tidak disimpan. Saat restore, kata sandi diambil dari
environment variable Coolify (`POSTGRES_PASSWORD`), sehingga arsip yang bocor
tidak sekaligus membocorkan kredensial database.

### Lapisan kedua: snapshot VPS Hostinger

Paket VPS menyertakan backup mingguan seluruh mesin, disimpan pada
infrastruktur Hostinger — bukan pada disk VPS ini. Terkonfirmasi aktif, dengan
backup terakhir selesai 31 Juli 2026 22:48:55.

Ini menutup skenario kehilangan disk atau kehilangan mesin, dan berarti
pernyataan "seluruh salinan berada pada disk yang sama" tidak lagi berlaku
seluruhnya. Tetapi ia menjawab pertanyaan yang berbeda dari checkpoint di §4a:

| | Snapshot VPS | Checkpoint `backup.sh` |
|---|---|---|
| Frekuensi | Mingguan | Harian |
| Cakupan | Seluruh mesin | Database dan volume unggahan |
| Granularitas restore | Seluruh mesin sekaligus | Satu database, atau satu tabel |
| Konsistensi | Crash-consistent; PostgreSQL memulihkan diri lewat WAL | Dump logis yang sudah dibaca ulang `pg_restore --list` |
| Bukti keutuhan | Tidak ada | `MANIFEST.txt` berisi jumlah baris dan `SHA256SUMS` |

Konsekuensi yang perlu disadari: pada kehilangan VPS total, kehilangan data
dapat mencapai **tujuh hari** — bukan 24 jam — karena checkpoint harian ikut
hilang bersama disknya. Itulah celah yang ditutup §4b.

### Enkripsi sebelum meninggalkan server

Arsip dienkripsi dengan GPG simetris (AES-256) tepat sebelum diunggah, dan
salinan terenkripsi itulah yang dikirim ke penyimpanan objek. Siapa pun yang
dapat membaca keranjangnya hanya menemukan data acak.

Salinan **lokal** sengaja dibiarkan apa adanya, dilindungi permission `0600`.
Kuncinya toh ada di server yang sama, jadi mengenkripsi salinan lokal tidak
menambah perlindungan — ia hanya mempersulit pemulihan pada saat paling genting.

GPG dipilih bukan karena paling canggih, melainkan karena paling mungkin masih
dapat dibuka bertahun-tahun kemudian di mesin mana pun. Untuk backup, itulah
satu-satunya ukuran yang penting.

**Frasa sandinya ada di `/etc/lms-backup.env` (`BACKUP_ENCRYPTION_PASSPHRASE`,
mode 0600, hanya root).** Kalau server ini hilang bersama frasa sandinya,
seluruh salinan offsite menjadi tidak dapat dibuka — dan justru itulah keadaan
ketika backup offsite paling dibutuhkan. Simpan salinannya di password manager,
di luar server ini.

Setiap malam skrip mendekripsi kembali arsipnya sendiri dan membandingkan
sha256 sebelum mengunggah. Bila tidak cocok, unggahan dibatalkan dan
peringatan terkirim. Enkripsi yang tidak pernah diuji hanya memindahkan
kegagalan ke hari ketika backup itu benar-benar dibutuhkan.

Putaran penuhnya — enkripsi, unggah, unduh, dekripsi — dapat diuji kapan saja
tanpa menunggu arsip belasan gigabyte:

```bash
. /etc/lms-backup.env && LMS_APP_UUID=<uuid> lms-backup --test-offsite
```

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

Arsip dari penyimpanan objek berakhiran `.tar.gpg` dan harus didekripsi lebih
dulu. Salinan lokal di server tidak terenkripsi, jadi langkah ini dilewati bila
memulihkan dari sana.

```bash
# Hanya untuk arsip yang diambil dari penyimpanan objek.
gpg --batch --pinentry-mode loopback --passphrase-file <(sudo grep -oP \
  '(?<=^export BACKUP_ENCRYPTION_PASSPHRASE=).*' /etc/lms-backup.env) \
  --decrypt lms-<stempel>.tar.gpg > lms-<stempel>.tar
```

```bash
tar xf /var/backups/lms-ai/daily/lms-<stempel>.tar -C /tmp/pulih
cd /tmp/pulih && sha256sum -c SHA256SUMS       # arsip utuh

# Role lebih dulu; tanpa ini setiap GRANT gugur.
psql -U postgres -f globals.sql
createdb -U postgres lms
pg_restore -U postgres -d lms --no-owner database.dump

# Volume dipulihkan bersama database agar object_key tetap menunjuk file nyata.
tar xzf avatar-data.tar.gz -C /data/avatars
tar xzf course-thumbnail-data.tar.gz -C /data/course-thumbnails
tar xzf material-data.tar.gz -C /data/materials

# video-data TIDAK ada di arsip; lihat "Pengecualian video-data" di §4a.
# Berkas video diunggah ulang dari salinan master di luar server, ke object key
# yang sama seperti tercatat pada tabel video_assets hasil restore.
```

Verifikasi: bandingkan jumlah baris terhadap `MANIFEST.txt`, pastikan
`_prisma_migrations` menunjuk migrasi yang sama, lalu cocokkan `object_key`
pada `video_assets` dengan daftar berkas di arsip volume.

Untuk video, pencocokan itu berjalan terbalik: daftar `object_key` hasil
restore adalah daftar berkas yang harus disediakan kembali. Selama masih ada
key yang belum punya berkas, pemutaran video gagal walaupun seluruh pemeriksaan
database sudah lulus — dan itulah kegagalan yang paling mudah terlewat, karena
tidak ada satu pun angka di MANIFEST yang menjadi merah karenanya.

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

### Drill 1 Agustus 2026

Dijalankan setelah migrasi `20260801040000_video_asset_library`, karena drill
sebelumnya (31 Juli) memakai skema lama dan tidak lagi membuktikan apa pun
tentang bentuk yang sekarang.

Checkpoint `20260801T071442Z` direstore ke container PostgreSQL 16 terpisah:

- Jumlah baris cocok persis dengan `MANIFEST.txt` pada keenam tabel yang
  dihitung.
- `lessons.video_asset_id` ada, `video_assets.lesson_id` sudah tidak ada —
  arah relasi yang baru ikut terbawa, bukan hanya datanya.
- Empat pelajaran bervideo tetap tertaut, 21 migrasi tercatat selesai.

Yang belum dicakup drill ini: menjalankan critical E2E flow terhadap database
hasil restore, dan memulihkan volume unggahan. Keduanya masih menunggu.

### Drill 5 Agustus 2026

Dijalankan oleh `scripts/restore-drill.sh`, yang lahir dari drill ini supaya
yang berikutnya tidak perlu disusun ulang dari awal. Tanpa argumen ia memakai
checkpoint harian terbaru; produksi tidak disentuh, seluruhnya berjalan di
container dan volume terpisah yang dibuang di akhir.

Checkpoint `20260804T183003Z` (3,2 G), yaitu checkpoint terenkripsi pertama —
drill sebelumnya dibuat sebelum enkripsi offsite menyala, dan 8 migrasi lebih
tua daripada skema sekarang.

Hasil, 13 pemeriksaan lulus, 0 gagal:

- `sha256sum -c SHA256SUMS` cocok untuk seluruh isi arsip.
- Jumlah baris cocok persis dengan `MANIFEST.txt` pada keenam tabel: users 4,
  enrollments 112, lesson_progress 28, registration_orders 6, video_assets 172,
  forum_topics 1.
- 29 migrasi tercatat selesai, dan yang terakhir sama dengan yang dicatat
  MANIFEST: `20260804020000_lesson_materials`.
- 109 enrollment berstatus ACTIVE masih tersambung utuh ke baris `users` dan
  `courses`-nya lewat join — bukan hanya ada, melainkan masih menunjuk sesuatu.

Menutup gap pertama yang dicatat drill 1 Agustus — volume unggahan kini ikut
dipulihkan dan diperiksa:

| Volume | Hasil |
|---|---|
| `video-data` | 90 berkas, 3,2 G |
| `avatar-data` | 1 berkas, 196 K |
| `course-thumbnail-data` | 1 berkas, 796 K |
| `material-data` | kosong — benar, `lesson_materials` di produksi juga 0 baris |

Satu berkas contoh dari `course-thumbnail-data` dibuka dan header binernya
dibaca: `52494646` (RIFF/WebP). Berkasnya gambar sungguhan, bukan sekadar nama
berukuran benar.

Dua kegagalan yang muncul pada percobaan pertama keduanya ada pada alat
ukurnya, bukan pada cadangannya, dan keduanya sudah diperbaiki di skripnya:
jumlah migrasi dibandingkan dengan jumlah folder migrasi di repo hari ini
(repo bergerak, arsip tidak), dan pemeriksa berkas contoh hanya mengenali PNG
serta JPEG sehingga menyatakan WebP yang sah sebagai tidak dikenali.

Yang masih belum dicakup: menjalankan critical E2E flow terhadap database
hasil restore. Itu menuntut menyalakan API terhadap database drill, dan belum
dikerjakan.

---

## 7. Ownership

| Area | Owner |
|---|---|
| Backup configuration | DevOps Engineer |
| Database integrity | Database Engineer |
| Restore validation | QA Engineer |
| Security review | Security Reviewer |
| Business approval | Engineering Manager/Product Owner |
