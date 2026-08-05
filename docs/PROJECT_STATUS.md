# Status Proyek

Berkas ini ditulis untuk dibaca di awal sesi baru, oleh saya sendiri di hari
berikutnya atau oleh siapa pun yang melanjutkan. Isinya bukan arsitektur —
itu ada di `docs/DOCUMENTATION_INDEX.md` — melainkan tiga hal yang tidak
tersimpan di mana pun kecuali di kepala orang yang baru saja mengerjakannya:
keadaan produksi hari ini, apa yang sudah ditutup, dan apa yang sengaja
dibiarkan terbuka beserta alasannya.

Terakhir diperbarui: **5 Agustus 2026**, setelah deploy 167 (`91ee1cb`).

---

## 1. Keadaan hari ini

Akademi sudah hidup dan sudah menerima uang sungguhan. Ini bukan proyek yang
sedang dibangun menuju rilis; ini proyek yang sedang berjalan.

| | |
|---|---|
| Domain | https://academy.aipreneur.co.id |
| Repo | `kvnlhm/lms-ai`, cabang `feat/walking-skeleton-and-master` — **publik** |
| VPS | Hostinger `31.97.105.104`, 7 GB RAM, sisa disk ±45 G dari 96 G |
| Orkestrasi | Coolify 4.1.2, aplikasi UUID `e1b4fo52n9tnzjpm5m2i5k8l` |
| Deploy terakhir | 167 — `91ee1cb`, selesai 5 Agustus 2026 09:44 UTC |
| Pembayaran | Midtrans **Production** (bukan sandbox) |
| Email | Resend, domain pengirim `send.aipreneur.co.id` |
| Pemantauan | UptimeRobot, `HEAD /api/v1/health/ready` tiap 5 menit |

Isi database produksi per 5 Agustus 2026:

```
migrasi terpasang   31
users                4
courses             38
lessons            185
enrollments        139
video_assets       195
registration_orders  6   (PAID 3, FAILED 2, EXPIRED 1)
```

`lesson_materials` masih 0 baris — jadi volume `material-data` yang kosong itu
benar, bukan cacat. Ini pernah salah dibaca sebagai kegagalan cadangan.

---

## 2. Cara bekerja di mesin ini

Sesi Claude berjalan **langsung di VPS produksi**, bukan di laptop. Konsekuensinya
harus dipegang erat.

**Host tidak punya node dan tidak punya pnpm.** Semua build dan test dijalankan di
container `node:22-alpine` dengan repo di-mount ke `/w`, memakai `pg-test`
(10.0.0.3) dan `redis-test` (10.0.0.4).

**Deploy:**

```bash
docker exec coolify php artisan tinker --execute="echo queue_application_deployment(application: App\Models\Application::where('uuid','e1b4fo52n9tnzjpm5m2i5k8l')->first(), deployment_uuid: (string) Illuminate\Support\Str::uuid(), force_rebuild: false);"
```

**Memantau deploy:**

```bash
docker exec coolify-db psql -U coolify -d coolify -tAc \
  "select id, commit, status from application_deployment_queues order by id desc limit 3"
```

Jangan menambahkan `where application_id = 1` — kolomnya `varchar`, dan
perbandingannya dengan integer akan meledak.

**Memverifikasi hasil deploy:**

```bash
LMS_APP_UUID=e1b4fo52n9tnzjpm5m2i5k8l bash scripts/verify-deploy.sh
```

**Database produksi:**

```bash
docker exec postgres-e1b4fo52n9tnzjpm5m2i5k8l sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "..."'
```

Tabel pesanan bernama `registration_orders`, bukan `orders`.

**Turborepo 2 memakai strict environment mode.** `globalEnv` di `turbo.json` hanya
berisi `["NODE_ENV", "APP_ENV"]`, jadi `DATABASE_URL`, `REDIS_URL`, dan
`MFA_ENCRYPTION_KEY` **tidak sampai** ke `pnpm test`. Perintah lewat
`pnpm --filter <paket> run <skrip>` melewati Turborepo dan tetap mendapat env
sekitarnya. Selisih inilah yang membuat test lulus di sini tetapi gagal di CI.

**Cron yang berjalan di host** (`crontab -l`):

```
30 18 * * *  lms-backup        cadangan harian, terenkripsi, disalin ke R2
*/5 * * * *  lms-health-watch   pemeriksa kesehatan lokal
```

Kredensial R2 hanya ada di `/etc/lms-backup.env` (chmod 600, di luar repo).

---

## 3. Aturan yang tidak boleh dilanggar

Bukan preferensi gaya. Setiap butir di bawah ini lahir dari kejadian nyata atau
keputusan eksplisit pemiliknya.

- **Repo ini publik.** Tidak ada satu pun secret boleh masuk ke dalamnya
  (`AGENTS.md` baris 64).
- **Jangan pernah `git add -A`.** Sebut berkasnya satu per satu.
- **Jangan pernah `git stash`, `git checkout`, atau operasi git apa pun yang
  menyapu seluruh working tree.** Pemiliknya menyunting di VPS yang sama, dan
  perintah semacam itu akan menghapus pekerjaannya tanpa peringatan.
- **Jangan me-restart daemon Docker.** Itu menjatuhkan produksi.
- **Pengamanan SSH, firewall, dan `/etc` ditunda pemiliknya pada 30 Juli 2026.**
  Jangan diangkat lagi.
- **`REQUIRE_MASTER_MFA=false` di produksi adalah keputusan sadar pemiliknya.**
  Bukan celah, jangan dilaporkan sebagai kekurangan.
- **Commit atas nama `Jegstudio <jegstudio@Jegstudios-Mac-mini.local>` adalah
  karya pemiliknya sendiri** dari Mac mini-nya. Bukan orang lain.
- **Arah desain: "sisi master dulu, tapi jangan sampai sisi pelajar rusak."**
  Rujukannya Circle.so. Kelas navigasi mobile dipakai bersama kedua sisi, jadi
  menyentuhnya berarti menyentuh keduanya.
- **Kalimat anti-enumerasi pada lupa-kata-sandi harus dipertahankan apa adanya.**
  Ia sengaja tidak memberi tahu apakah surelnya terdaftar.
- **Frasa sandi cadangan tidak boleh dicetak di percakapan.** Pemiliknya yang
  mengambilnya sendiri.

---

## 4. Yang sudah ditutup pada pemeriksaan ini

Lima dari sembilan butir daftar. Diurutkan dari yang termudah, atas permintaan
pemiliknya.

1. **Stash lama dibuang.** Sisa dari sesi sebelumnya, sudah tidak relevan.
2. **Pesanan yang menggantung ditutup.** Satu pesanan berstatus tidak jelas
   diselesaikan menjadi `EXPIRED`.
3. **CI dinyalakan** — `62300cb`. Pemicunya dulu hanya `pull_request` dan push ke
   `main`, sementara tidak pernah ada pull request yang dibuka. Cabang kerja
   sempat **57 commit di depan `main` tanpa satu pun pemeriksaan**. Sebelum
   dinyalakan, rangkaiannya dijalankan lebih dulu di container yang meniru env
   runner, dan itu menemukan dua cacat sungguhan yang selama ini menumpuk tak
   terlihat:
   - drift antara migrasi dan `schema.prisma` pada tabel community — ditutup
     lewat migrasi `20260805060000_align_community_defaults` (`51b9c20`);
   - tiga test konfigurasi yang menumpang `MFA_ENCRYPTION_KEY` dari lingkungan
     sekitar, variabel yang Turborepo memang tidak teruskan.

   Dua kali jalan CI di GitHub sesudahnya: hijau.
4. **Restore drill dijadikan skrip** — `scripts/restore-drill.sh`, `51b9c20`.
   Tanpa argumen ia memilih checkpoint harian terbaru sendiri; drill yang menuntut
   orang mengetik nama arsip adalah drill yang tidak pernah dijalankan.
   Seluruhnya berjalan di container dan volume buangan, produksi tidak disentuh.
   Hasil 5 Agustus: **13 lulus, 0 gagal**, termasuk yang dulu dicatat "masih
   menunggu" — empat volume unggahan benar-benar dipulihkan, dan satu berkas
   contoh dibaca header binernya untuk membuktikan isinya sungguhan. Tercatat di
   `docs/operations/BACKUP_RESTORE.md`.
5. **UptimeRobot terpasang benar.** Log gateway memperlihatkan
   `HEAD /api/v1/health/ready 200` dari `52.22.236.30` tiap lima menit, dari luar
   VPS. Sudah sesuai.
6. **Urutan katalog diserahkan kepada Master** — `f6a4522`, deploy 165. Di luar
   daftar sembilan butir; diminta terpisah oleh pemiliknya.

   Sebelumnya urutan kartu di `/courses` ditentukan mesin — terbit terbaru dulu,
   lalu abjad — dan Master tidak punya satu pun cara mengubahnya. Kursus pembuka
   bisa terdorong ke halaman dua hanya karena kursus lain terbit belakangan.

   - Kolom `courses.position`, migrasi `20260805100000_course_position`. Diisi
     mundur dengan urutan yang berlaku saat itu, bukan nol semua, supaya katalog
     tidak berubah tampilan pada detik migrasi dijalankan.
   - `PUT /api/v1/admin/courses/order` menerima urutan seluruh kursus sekaligus.
     Daftar sebagian ditolak 422: kursus yang tidak disebut akan mempertahankan
     nomor lamanya dan bertabrakan dengan nomor baru milik kursus lain.
   - Penulisannya SQL langsung, bukan lewat klien Prisma, supaya `updatedAt`
     tidak ikut tersentuh. Kalau tidak, menggeser satu kartu akan menandai
     ke-38 kursus sebagai baru disunting padahal isinya tidak disentuh.
   - `/master/courses?atur=1` memuat seluruh kursus tanpa pemenggalan halaman,
     lalu menyeretnya dengan Pointer Events — bukan drag-and-drop bawaan HTML,
     yang tidak pernah terpicu oleh sentuhan dan akan mati total di ponsel.
     Kotak nomor melengkapinya untuk lompatan jauh yang tak nyaman diseret.
   - Halaman pelajar `/courses` tidak diubah satu baris pun; yang berubah hanya
     urutan yang dikirim API.

   Terverifikasi di produksi: 38 kursus terisi nomor 1–38 tanpa satu pun kembar.
   Empat test e2e baru menutup penempatan kursus baru di ekor, urutan yang
   diikuti katalog pelajar, penolakan daftar sebagian, dan `updatedAt` yang tidak
   tersentuh.

   Catatan untuk sesi berikutnya: judul kursus di produksi sudah bernomor sendiri
   ("27. Claude AI", "26. Heygen", …), tetapi urutan hasil isi-mundur justru
   menaruh nomor besar di depan. Pemiliknya kemungkinan akan membalikkannya lewat
   antarmuka; itu keputusan isi, bukan cacat.

   Layar penataannya kemudian diubah menjadi kisi kartu (`91ee1cb`, deploy 167),
   memakai `.courseGrid`, `.cover`, dan `.courseName` yang sama dengan katalog
   pelajar — dipakai bersama, bukan disalin, supaya keduanya tidak dapat berbeda
   tanpa sengaja. Ambang titik tengah pada logika seret dihapus di sana: ia benar
   untuk daftar menurun, tetapi pada kisi tetangga sebuah kartu bisa berada di
   kanan atau di bawah, sehingga ambang satu sumbu salah pada separuh arah.
7. **Daftar kursus Master dapat disortir** — `5cfcc67`, deploy 166. Juga di luar
   daftar sembilan butir.

   Tujuh kolom: urutan, judul, status, bagian, terdaftar, diperbarui, terbit.
   Daftarnya tertutup karena nilainya berakhir di `orderBy` Prisma; `?sort=`
   sembarang ditolak 422.

   - `id` selalu menjadi pemutus seri terakhir. Menyortir menurut status
     meninggalkan puluhan baris bernilai sama, dan tanpa pemutus unik paginasi
     `skip`/`take` dapat memunculkan satu kursus di dua halaman sekaligus
     sementara kursus lain hilang — tanpa satu pun galat. Ada test untuk ini.
   - `publishedAt` disortir dengan `nulls: 'last'`; draf dan arsip ber-NULL dan
     pada DESC PostgreSQL menaruhnya paling depan.
   - Kendalinya ada di dua tempat yang keduanya tautan biasa: pil di atas tabel
     dan kepala kolom yang dapat diklik. Pilnya wajib — di lebar ponsel `thead`
     disembunyikan, jadi kepala kolom saja membuat penyortiran tidak terjangkau.
   - `lessonCount` tidak dapat disortir; angkanya berjarak dua relasi dari kursus
     sehingga `_count` Prisma tidak menjangkaunya. Kolomnya dibiarkan polos, bukan
     diberi tautan yang tidak melakukan apa-apa.

Dua koreksi yang perlu diingat supaya tidak diulang sebagai "temuan":

- **SPF tidak hilang.** Domain Resend-nya memang `send.aipreneur.co.id`, jadi
  rekamannya ada di `send.send.aipreneur.co.id` — SPF dan MX keduanya lengkap di
  sana. Yang benar-benar tersisa hanya DMARC masih `p=none`, dan itu ringan.
- **Cadangan bukan tidak pernah dipulihkan.** Drill 1 Agustus sudah membuktikan
  databasenya pulih dan jumlah barisnya cocok. Yang memang belum, dan baru
  ditutup 5 Agustus, adalah volume unggahan dan pemeriksaan isi.

---

## 5. Yang masih terbuka

Ruang lingkup fitur MVP pada dasarnya sudah selesai. Yang tersisa hampir
seluruhnya operasional.

### Butir 6 — halaman legal *(separuh bisa dikerjakan tanpa pemiliknya)*

Formulir pendaftaran punya checkbox wajib di
`apps/web/app/register/registration-form.tsx:157` — "Saya menyetujui syarat
layanan dan pemrosesan data untuk aktivasi akun" — sementara halaman yang
disetujui itu tidak ada. Uang sungguhan sudah masuk tanpa Syarat Layanan dan
Kebijakan Privasi yang dapat dibaca pembeli.

Rute, halaman, tautan dari checkbox, dan kerangka isinya bisa dibangun. Teksnya
tidak — itu janji hukum pemiliknya.

> **Pertanyaan terbuka untuk pemiliknya:** apakah ada kebijakan pengembalian
> dana, dan dalam kondisi apa? Belum dijawab.

### Butir 7 — penjadwal, sapuan kedaluwarsa, rekonsiliasi pembayaran *(tidak butuh apa pun dari pemiliknya — paling penting)*

**Tidak ada penjadwal sama sekali** di `apps/api` maupun `apps/worker`. Pencarian
`@Cron`, `ScheduleModule`, dan `setInterval` mengembalikan nol. Artinya
rekonsiliasi pembayaran bergantung sepenuhnya pada webhook Midtrans. Satu webhook
hilang — jaringan, atau kebetulan tiba saat container berganti waktu deploy — dan
pesanan itu menggantung selamanya tanpa ada yang menyusul. Sudah ada satu pesanan
menggantung yang harus ditutup dengan tangan; itu gejalanya.

Yang perlu dibangun: penjadwal, sapuan yang menutup pesanan kedaluwarsa, dan
penyusul yang menanyakan ulang status ke Midtrans untuk pesanan yang masih
menggantung. Perkiraan ½–1 hari.

Catatan jebakan: `MidtransService.getStatus()` sudah menjaga kasus Midtrans
membalas HTTP 200 dengan `status_code: 404` di dalam body dan tanpa `order_id`.
Jangan dilucuti. Dan `MIDTRANS_ENVIRONMENT` bernilai `PRODUCTION` huruf besar —
skrip ad-hoc yang membandingkannya dengan `"production"` akan diam-diam menabrak
sandbox.

**Ini rekomendasi langkah berikutnya.** Sudah disampaikan tiga kali: paling
penting di seluruh daftar, dan tidak menuntut apa pun dari pemiliknya.

### Butir 8 — staging *(macet menunggu pemiliknya)*

Perkiraan ±1 hari. Berhentinya di satu hal yang hanya bisa dilakukan pemiliknya:
menambahkan A record `staging.academy` → `31.97.105.104`. `docs/operations/STAGING.md`
sudah ada sebagai rujukan.

### Butir 9 — sertifikat *(keputusan produk dulu)*

Beberapa hari kerja, dan bentuknya belum diputuskan. Bukan pekerjaan sampai
diputuskan.

### Bawaan dari sesi-sesi sebelumnya

- Migrasi untuk membuang `access_starts_at` dan `access_ends_at` dari
  `enrollments` — **sengaja ditunda** karena searah dan tidak dapat dibatalkan.
- `EnrollmentStatus` punya nilai `REMOVED` dan `EXPIRED` yang kini tidak pernah
  disetel siapa pun.
- `master/courses/[courseId]/enrollments` menarik seluruh `AdminCourseDetailDto`
  padahal hanya perlu sebagian.
- Alur E2E kritis belum pernah dijalankan terhadap database hasil restore. Ini
  celah terakhir yang tersisa di `BACKUP_RESTORE.md`.
- DMARC `send.aipreneur.co.id` masih `p=none`.

### Tindakan yang hanya bisa dilakukan pemiliknya

- Mengambil dan menyimpan frasa sandi cadangan. Tanpa itu, arsip terenkripsi
  yang rapi di R2 tidak berguna.
- Membuat ulang token auth Bunny — nilainya pernah melintas di percakapan dua
  kali.
- Mencabut token WhatsApp `whatsapp_business_management` yang sementara. Server
  hanya perlu yang bercakupan `whatsapp_business_messaging`, dan memang hanya itu
  yang dipegangnya.
- Menambahkan A record `staging.academy` bila staging jadi dikerjakan.
- Menjawab pertanyaan kebijakan pengembalian dana di butir 6.
- Opsional: menambahkan peringatan WhatsApp atau Telegram di UptimeRobot
  berdampingan dengan surel. Surel pukul tiga pagi jarang membangunkan siapa pun.

---

## 6. Bacaan lanjutan

| Untuk | Berkas |
|---|---|
| Peta seluruh dokumentasi | `docs/DOCUMENTATION_INDEX.md` |
| Aturan kerja agen | `AGENTS.md`, `CLAUDE.md` |
| Cadangan, restore, hasil drill | `docs/operations/BACKUP_RESTORE.md` |
| Deploy dan runbook VPS | `docs/operations/DEPLOYMENT.md`, `docs/operations/HOSTINGER_VPS_RUNBOOK.md` |
| Staging | `docs/operations/STAGING.md` |
| Variabel lingkungan | `docs/operations/ENVIRONMENT_VARIABLES.md` |
| Insiden | `docs/operations/INCIDENT_RESPONSE.md`, `docs/operations/incidents/` |
