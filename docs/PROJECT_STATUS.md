# Status Proyek

Berkas ini ditulis untuk dibaca di awal sesi baru, oleh saya sendiri di hari
berikutnya atau oleh siapa pun yang melanjutkan. Isinya bukan arsitektur —
itu ada di `docs/DOCUMENTATION_INDEX.md` — melainkan tiga hal yang tidak
tersimpan di mana pun kecuali di kepala orang yang baru saja mengerjakannya:
keadaan produksi hari ini, apa yang sudah ditutup, dan apa yang sengaja
dibiarkan terbuka beserta alasannya.

Terakhir diperbarui: **7 Agustus 2026**, setelah perapian kolom formulir
kelola channel, event, dan pengumuman, deployment **240** terverifikasi.

---

## 1. Keadaan hari ini

Akademi sudah hidup dan sudah menerima uang sungguhan. Ini bukan proyek yang
sedang dibangun menuju rilis; ini proyek yang sedang berjalan.

| | |
|---|---|
| Domain | https://academy.aipreneur.co.id |
| Repo | `kvnlhm/lms-ai`, cabang `feat/walking-skeleton-and-master` — **publik** |
| VPS | Hostinger `31.97.105.104`, 7 GB RAM, sisa disk ±64 G dari 96 G |
| Orkestrasi | Coolify 4.1.2, aplikasi UUID `e1b4fo52n9tnzjpm5m2i5k8l` |
| Deploy terakhir | commit `eb39980`, deployment **240**, selesai dan terverifikasi |
| Pembayaran | Midtrans **Production** (bukan sandbox) |
| Email | Resend, domain pengirim `send.aipreneur.co.id` |
| Pemantauan | UptimeRobot, `HEAD /api/v1/health/ready` tiap 5 menit |

Snapshot data produksi, dibaca langsung dari basis data pada 7 Agustus 2026
sesudah deployment 217:

```
migrasi terpasang            44
users                         4
courses                      38
lessons                     185
enrollments                 143
video_assets                195
community_posts               9   (aktif, belum terhapus)
community_post_attachments    2   (keduanya terikat postingan)
community_polls               0
registration_orders           6   (PAID 3, FAILED 2, EXPIRED 1)
```

`lesson_materials` masih 0 baris — jadi volume `material-data` yang kosong itu
benar, bukan cacat. Ini pernah salah dibaca sebagai kegagalan cadangan.

Aturan penyelesaian pelajaran, sesudah migrasi 7 Agustus:

```
VIDEO          MANUAL  123   OPENED 5
TEXT           MANUAL    2
EXTERNAL_LINK  MANUAL   55
```

Tidak ada lagi pelajaran ber-`VIDEO_PERCENTAGE`. Aturannya sendiri tidak dicabut
dari sistem; lihat §1c.

## 1a. Perubahan terbaru — Community Checklist

Fitur checklist personal per pelajar sudah selesai dan ikut deploy produksi
terbaru. Alur yang sekarang menjadi acuan:

1. Master menekan **Tambah checklist** pada sub-channel checklist; form inline
   terbuka untuk judul dan isi.
2. Master dapat membuka halaman edit khusus, mengubah judul/isi, serta mengganti
   atau menghapus satu lampiran per checklist.
3. Pelajar membuka checklist seperti postingan, membaca konten dan melihat
   lampiran, lalu mencentang selesai. Tombol berikutnya membawa ke checklist
   berikutnya.
4. Checklist tidak menerima balasan komentar maupun reaksi. Ini ditegakkan di
   server — `addComment` dan `toggleReaction` menolak 403 pada post checklist —
   bukan sekadar disembunyikan di antarmuka.

Lampiran yang diizinkan: JPEG, PNG, WebP, MP4, WebM, dan PDF, maksimum 100 MB.
Batas 100 MB itu **khusus checklist** dan sengaja dipertahankan ketika lampiran
postingan biasa lahir dengan batas 10 MB; lihat §1e.
Berkas disimpan di volume `community-attachment-data`, bukan di object key yang
terlihat oleh klien. Endpoint utamanya:

```
PUT    /api/v1/community/checklist/{postId}/attachment
DELETE /api/v1/community/checklist/{postId}/attachment
GET    /api/v1/community/checklist/{postId}/attachment
```

Migrasi attachment: `20260806173000_community_checklist_attachments`.
Commit fitur yang perlu diketahui sesi berikutnya: `5b6ac7c`, `bf2e5ee`,
`30112f3`, `009220f`; commit produksi terbaru juga memuat perbaikan backup,
`0efdf02` dan `08de193`.

## 1b. Checklist di feed diringkas menjadi satu kartu

Deployment 215 (`2a03ac5`) dan 216 (`5c2e1e9`), 7 Agustus.

Dua cacat tampilan pada permukaan yang sama, keduanya datang dari laporan
pemiliknya lewat tangkapan layar:

1. **Pemilih berkas lampiran memakai input bawaan browser.** Editor checklist
   adalah satu-satunya tempat yang menampilkan `<input type="file">` mentah,
   sehingga tombol "Choose File" dan teks "No file chosen" muncul terang di atas
   form gelap dan dalam bahasa Inggris. Seluruh pemilih berkas lain di aplikasi
   ini sudah menyembunyikan input-nya di balik label bergaya; editor checklist
   kini mengikuti pola yang sama (`2a03ac5`).

2. **Setiap langkah checklist mengalir ke feed sebagai tulisan lepas.** Satu
   Welcome Checklist berisi lima langkah muncul sebagai lima kartu berturut-turut,
   masing-masing lengkap dengan tombol suka dan kolom "Balas post ini…" — padahal
   API sudah menolak keduanya dengan 403. Kolom balasan itu hanya ada di layar dan
   tidak akan pernah berhasil dikirim. Checklist kini diwakili **satu kartu per
   sub-channel**: nama, jumlah topik, progres, dan tautan membuka halaman
   checklist, tanpa reaksi dan tanpa kolom balasan (`5c2e1e9`).

Kartunya berdiri pada posisi langkah terbarunya supaya urutan feed tetap
kronologis, bukan dipaksa naik ke atas.

Angka progresnya **tidak** dihitung dari tulisan yang sudah termuat. Feed
dipenggal per halaman, jadi menghitungnya di antarmuka akan menyebut "2 dari 2"
pada checklist yang sebenarnya berisi lima langkah. Karena itu ditambahkan
`checklistCompletedCount` pada `CommunitySubchannelDto`, dihitung server dengan
satu `groupBy`; penyebutnya memakai `postCount` yang sudah ada. Field itu hanya
bermakna pada endpoint daftar channel dan hanya untuk sub-channel `CHECKLIST` —
pada balasan endpoint pembuatan dan penyuntingan sub-channel nilainya selalu 0
dan tidak boleh dibaca sebagai progres.

Halaman checklist khusus dan halaman detail tiap langkah **tidak diubah**; yang
berubah hanya wakilnya di feed.

Ikut diperbaiki: pemilih tujuan pada composer feed tidak lagi menawarkan
sub-channel checklist. Composer di sana tidak punya kolom judul sedangkan
`publish` menolak item checklist tanpa judul, sehingga tombol Terbitkan diam saja
tanpa memberi tahu apa pun.

## 1c. Materi video diselesaikan dengan penandaan manual

Deployment 217 (`797baf5`), 7 Agustus. Migrasi
`20260807020000_video_lessons_manual_completion`.

Aturan `VIDEO_PERCENTAGE` tersimpan sejak lama tetapi baru benar-benar ditegakkan
belakangan (lihat catatan pada `completion-rule.ts`). Sejak saat itu 95 pelajaran
video menuntut 90% tontonan sebelum dapat diselesaikan, dan tombol "Tandai
selesai" pelajar mati sampai ambang itu terpenuhi. Pemiliknya memutuskan
penyelesaian materi video cukup ditandai sendiri oleh pelajar.

Yang berubah:

- Migrasi memindahkan seluruh pelajaran video ber-`VIDEO_PERCENTAGE` ke `MANUAL`.
  Terverifikasi di produksi: 95 → 0, dan `VIDEO MANUAL` naik dari 28 menjadi 123.
  Pelajaran video ber-`OPENED` (5), `TEXT`, dan `EXTERNAL_LINK` tidak tersentuh.
- Editor kursus tidak lagi memberi bawaan `VIDEO_PERCENTAGE` pada pelajaran video
  baru. Itu satu-satunya sumber bawaan tersebut: skema Prisma dan
  `course-authoring.service.ts` sebenarnya sudah lama berbawaan `MANUAL`.

Yang **tidak** berubah, dan jangan dilaporkan sebagai pekerjaan yang belum
selesai: aturan persentase video tetap ada di sistem. Penegakannya di server utuh
dan opsi "Persentase video" tetap dapat dipilih per pelajaran, jadi Master masih
bisa mewajibkan tontonan bila suatu saat diperlukan.

`completion_config` sengaja **tidak** dikosongkan. Di bawah `MANUAL` ia tidak
dibaca sama sekali, sedangkan membuangnya berarti menghapus angka yang dulu
dipilih Master — angka yang akan dipakai lagi kalau sebuah pelajaran dikembalikan
ke `VIDEO_PERCENTAGE`. Di produksi 85 dari 123 pelajaran video `MANUAL` masih
memegang config-nya.

Migrasi ini tidak sepenuhnya dapat dibalik: 10 dari 95 pelajaran ber-config kosong,
dan sesudah menjadi `MANUAL` mereka tidak dapat dibedakan dari 28 pelajaran video
yang memang sudah manual sejak awal. Karena itu keadaan sebelum migrasi disimpan
terarah di luar repo:

```
/var/backups/lms-ai/pre-migration/video-completion-rules-20260807T021241Z.csv
```

128 baris, chmod 600, berisi `id`, `completion_rule`, dan `completion_config`
seluruh pelajaran video sebelum perubahan.

Progres pelajar tidak bergeser sedikit pun: 11 `COMPLETED` dan 40 `IN_PROGRESS`
sebelum dan sesudah migrasi.

Verifikasi deployment 217 berhasil untuk gateway, web, API, worker, Postgres,
Redis, homepage HTTP 200, readiness DB/Redis, seluruh 41 migrasi, dan tidak ada
runtime error sejak API start.

## 1d. Sidebar Pelajar diratakan menjadi daftar minimalis

Deployment 218 (`a1c4b3b`) dan 219 (`1f09848`), 7 Agustus. Perubahan tampilan
saja; tidak ada migrasi.

Nama Channel dulu berupa tombol accordion dengan chevron dan baris
"3 sub-channel" di bawahnya, dan tiap sub-channel membawa keterangannya sendiri
sebagai baris kedua. Empat channel sudah memenuhi layar padahal isinya hanya
sepuluh tautan. Rujukannya tangkapan layar Circle.so dari pemiliknya.

Nama Channel kini menjadi label kelompok seperti pintasan komunitas di sidebar
Master: seluruh sub-channel langsung terlihat, satu baris, ikon plus nama.
Penanda halaman aktif memakai latar lembut, bukan bilah biru di tepi kiri.
Glif teks `#`, `▤`, `!`, `✓` diganti ikon garis dari sistem ikon — glif itu
diambil dari font berbeda-beda per sistem sehingga tingginya tidak pernah
sejajar dengan ikon Monitoring di kolom yang sama.

Satu jebakan yang sudah dikunci test dan **jangan dilepas**: `.channelGroup`
wajib ber-`flex:none`. Sidebar adalah flex column setinggi layar, dan
`overflow:hidden` menihilkan ukuran minimum otomatis, sehingga label kelompok
mengerut sampai tinggi 0 begitu daftarnya melebihi layar — labelnya hilang sama
sekali, bukan terpotong.

Halaman chat dan checklist tidak tersentuh.

## 1e. Postingan komunitas menerima lampiran banyak dan jajak pendapat

Deployment 232 (`8f6163c`), 7 Agustus. Tiga migrasi:
`20260807140000_community_post_multiple_attachments`,
`20260807150000_community_post_title`, `20260807160000_community_polls`.

Diminta pemiliknya dengan rujukan composer Circle.so. Cakupannya diputuskan
lewat empat pertanyaan: gambar, video, PDF, dan polling; Master **dan** Pelajar
boleh melampirkan; maksimum 10 berkas 10 MB per postingan; composer berbentuk
modal dengan judul opsional.

Yang berubah pada modelnya:

- `CommunityPostAttachment` dulu terkunci satu lampiran per postingan lewat
  UNIQUE pada `post_id`, dan hanya untuk channel CHECKLIST. Sekarang `post_id`
  **boleh kosong**: composer mengunggah sebelum postingannya ada. Menerbitkan
  dulu lalu mengunggah berarti setiap pembaca melihat tulisan tanpa gambarnya
  selama unggahan berjalan, dan tulisan itu tinggal selamanya bila unggahannya
  gagal.
- `uploader_id` diisi mundur dari penulis postingannya; dipakai memeriksa
  pengikatan dan menyapu unggahan tergantung.
- `position` menyimpan urutan pilihan penulisnya. Tanpa itu urutan gambar
  mengikuti `created_at`, yang berubah sendiri setiap kali unggahan paralel
  selesai dengan kecepatan berbeda.
- `community_posts.checklist_title` di-RENAME menjadi `title`. Composer punya
  kolom judul untuk semua postingan, sedangkan `createPost` dulu membuang judul
  itu diam-diam untuk channel non-checklist. RENAME, bukan tambah-salin-buang,
  supaya tidak ada jendela waktu ketika dua kolom bisa berbeda isi. Aturannya
  tidak berubah: judul tetap wajib di CHECKLIST, opsional di luar itu.

Pengikatan lampiran berada **di dalam transaksi** pembuatan postingan. Lampiran
milik orang lain, atau yang sudah dipakai postingan lain, ditolak 422 alih-alih
dilewati diam-diam.

Unggahan yang tidak pernah diterbitkan disapu `StaleUploadSweeper` lewat port
pemulih yang sudah ada. Lariknya dipindah ke `StorageModule`: token yang sama
disediakan dua modul **tidak bergabung** — yang belakangan menimpa yang duluan,
dan penyapu akan kehilangan salah satu pemulihnya tanpa satu pun galat.

Batasnya sengaja dipisah dua. Checklist tetap 100 MB
(`COMMUNITY_ATTACHMENT_MAX_UPLOAD_BYTES`), dikurasi Master. Postingan biasa
10 MB (`COMMUNITY_ATTACHMENT_MAX_DRAFT_UPLOAD_BYTES`) dan sepuluh berkas
(`COMMUNITY_ATTACHMENT_MAX_PER_POST`), karena di sana Pelajar ikut mengunggah ke
disk VPS yang juga menampung basis data beserta cadangannya.

Jajak pendapat menempel pada postingan biasa, bukan jenis postingan tersendiri.
`community_poll_votes.poll_id` sengaja menyimpan ulang apa yang dapat ditelusuri
lewat `option_id`; itulah yang membuat "satu suara per orang per polling"
ditegakkan basis data lewat UNIQUE, bukan dijaga kode aplikasi yang akan kalah
oleh dua permintaan yang tiba bersamaan. Memilih ulang memindahkan suara lewat
`upsert`. Hasilnya terlihat sejak awal, sebelum orangnya memilih — menyembunyikan
hasil memaksa orang menekan pilihan hanya untuk dapat melihatnya.

**Satu pilihan per orang.** Polling banyak-jawaban tidak dibuat; menambahkannya
berarti kolom `allowMultiple` dan penggantian UNIQUE-nya.

Halaman chat dan checklist tidak tersentuh — keduanya punya composer sendiri
yang memang bukan modal.

Perbaikan lanjutan pada alur lampiran postingan:

- Composer memulihkan draf lampiran milik penulis dari endpoint
  `GET /api/v1/community/attachments/drafts` setelah halaman atau composer
  dibuka ulang. Draf tidak lagi memenuhi batas 10 berkas tanpa bisa ditemukan
  pengguna; setiap draf tetap dapat dibuang dari daftar sebelum menerbitkan.
- Lightbox gambar kini menyediakan tombol foto sebelumnya/berikutnya dan
  pintasan keyboard `ArrowLeft`/`ArrowRight`; tombol hanya muncul bila ada lebih
  dari satu gambar.
- Pada 7 Agustus, sepuluh draf yatim akibat percobaan upload sebelumnya dibuang
  dari database dan volume storage production; hitungan draf akun kembali nol.
- Validasi payload publish kini menerima 10 `attachmentIds`, sama dengan batas
  composer dan service lampiran. Sebelumnya DTO API masih membatasi 5 sehingga
  postingan dengan lampiran keenam ditolak sebagai `Data yang diberikan tidak valid.`

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

Butir pemeriksaan historis berikut sudah ditutup. Nomornya dipertahankan agar
rujukan dari sesi lama tetap dapat ditemukan.

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
8. **Community Checklist selesai dan live** — alur baca/centang/lanjut,
   editor khusus, form tambah checklist, dan lampiran media sudah terverifikasi
   di produksi. Detail implementasi ada di §1a dan ADR-031.
9. **Backup harian disesuaikan dengan kapasitas disk** — `0efdf02` mengecualikan
   volume video yang memang disimpan pemilik di luar VPS dan membatasi retensi;
   `08de193` mencatat volume yang tidak ikut arsip di manifest checkpoint.
10. **Checklist di feed diringkas menjadi satu kartu** — `2a03ac5` dan `5c2e1e9`,
    deployment 215 dan 216. Detail di §1b.
11. **Materi video dipindahkan ke penandaan manual** — `797baf5`, deployment 217,
    migrasi `20260807020000_video_lessons_manual_completion`. Detail di §1c.
12. **Sidebar Pelajar diratakan** — `a1c4b3b`, `4e39611`, `1f09848`, deployment
    218 dan 219. Detail di §1d.
13. **Lampiran banyak dan jajak pendapat pada postingan** — `ef7375f`, `58eee5b`,
    `ee71c72`, `e9af445`, deployment 221. Detail di §1e.
14. **`community-attachment-data` ternyata tidak hilang.** Manifest 6 Agustus
    mencatatnya `volume_dicari_tapi_hilang` semata karena saat itu belum ada satu
    pun lampiran, sehingga Docker belum benar-benar membuat volumenya. Checkpoint
    7 Agustus 05:25 mencatat `volume_dicari_tapi_hilang: tidak ada` dan memuat
    `community-attachment-data.tar.gz`. Jangan diangkat lagi sebagai temuan.

Tiga koreksi yang perlu diingat supaya tidak diulang sebagai "temuan":

- **SPF tidak hilang.** Domain Resend-nya memang `send.aipreneur.co.id`, jadi
  rekamannya ada di `send.send.aipreneur.co.id` — SPF dan MX keduanya lengkap di
  sana. Yang benar-benar tersisa hanya DMARC masih `p=none`, dan itu ringan.
- **Cadangan bukan tidak pernah dipulihkan.** Drill 1 Agustus sudah membuktikan
  databasenya pulih dan jumlah barisnya cocok. Yang memang belum, dan baru
  ditutup 5 Agustus, adalah volume unggahan dan pemeriksaan isi.
- **`LMS_APP_UUID` tidak hilang dari konfigurasi cadangan.** Ia memang tidak ada
  di `/etc/lms-backup.env`, tetapi diset sebagai variabel **crontab** berikut
  `LMS_ALERT_TO`. Menjalankan `lms-backup` dengan hanya me-`source` env file akan
  gagal dengan "LMS_APP_UUID belum diset" — itu kekurangan shell yang memanggil,
  bukan cacat konfigurasi. Jangan "memperbaiki"-nya.
- **Aturan `VIDEO_PERCENTAGE` tidak dicabut.** Sesudah migrasi 7 Agustus tidak ada
  lagi pelajaran yang memakainya, tetapi aturan, penegakannya di server, dan
  opsinya di editor semuanya masih ada dan memang disengaja. Nol pemakai bukan
  berarti kode mati yang perlu dibersihkan.

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

### Catatan operasi terbaru

- Percobaan backup/deploy sempat gagal karena disk penuh saat mengarsipkan
  `video-data`. Artefak deploy dibersihkan otomatis; per 7 Agustus disk kembali
  sekitar 64 GB kosong dari 96 GB.
- Checkpoint terbaru yang dipakai sebagai backup gate sebelum migrasi 7 Agustus:
  `/var/backups/lms-ai/daily/lms-20260806T235046Z.tar`. Manifest mencatat migrasi
  terakhir `20260806160000_community_checklist_content` dan tabel penting
  (`users 4`, `enrollments 143`, `lesson_progress 51`, `registration_orders 6`,
  `video_assets 195`, `forum_topics 2`).
- Ketiadaan `video-data` di arsip **bukan** kegagalan; itu pengecualian yang
  disengaja dan sudah dijelaskan di `docs/operations/BACKUP_RESTORE.md`.
- Cron cadangan 6 Agustus 18:30 **gagal** dengan `no space left on device` saat
  mengarsipkan `video-data`; checkpoint 6 Agustus 23:50 adalah hasil jalan manual.
  Sesudah pengecualian volume video berlaku, jalan manual 7 Agustus 05:25 selesai
  dalam 30 detik dan hanya 24 MB. Periksa `/var/backups/lms-ai/cron.log` bila
  ragu apakah cron malam berhasil — status "checkpoint terbaru ada" saja tidak
  membuktikan cron-nya sehat.
- Manifest checkpoint 6 Agustus mencatat `migration_terakhir`
  `20260806160000_community_checklist_content`, padahal produksi saat itu sudah
  memasang `20260806173000_community_checklist_attachments`. Selisih ini belum
  dijelaskan. Manifest 7 Agustus mencatat `20260807020000_...` dan cocok dengan
  produksi saat itu, jadi selisihnya tidak berulang.
- **Deployment 220 gagal, 221 berhasil dengan commit yang sama.** Build 220 sudah
  sampai `Generating static pages (9/9)` lalu Coolify melapor
  `No such container` untuk container helper build-nya sendiri. Tidak ada jejak
  OOM di kernel, disk 57 GB kosong, dan perekaman resource selama build 221
  menunjukkan memori bebas tidak pernah turun di bawah 4,8 GB dari 7 GB. Kegagalan
  transien Coolify, bukan kode maupun kapasitas. Baru sekali terjadi — kejar
  sebagai masalah nyata hanya bila berulang.
- **Volume lampiran mulai tumbuh.** Pelajar kini dapat menaruh berkas di disk
  VPS. Setelah deployment 232, `community-attachment-data` berisi sekitar 195 MB
  dalam 78 file. Penahannya: 10 MB × 10 berkas per postingan, dan penyapu yang
  membuang unggahan yang tidak jadi diterbitkan. Layak dipantau bersama disk.
- Keadaan aturan penyelesaian pelajaran video sebelum migrasi 7 Agustus disimpan
  di `/var/backups/lms-ai/pre-migration/`, di luar repo. Lihat §1c.

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

## 6. Handoff untuk sesi berikutnya

Mulai sesi baru dengan urutan singkat ini sebelum mengubah kode:

```bash
rtk git status --short
rtk git log -8 --oneline --decorate
rtk sed -n '1,200p' docs/PROJECT_STATUS.md   # §1 sampai §3; sisanya sesuai kebutuhan
```

Berkasnya kini ±670 baris. Bagian yang wajib dibaca lebih dulu adalah §1 sampai
§3 — keadaan hari ini, cara bekerja di mesin ini, dan aturan yang tidak boleh
dilanggar. §4 dan §5 dibaca ketika hendak menyentuh area yang bersangkutan.

Lalu baca `docs/DOCUMENTATION_INDEX.md`, `docs/PRD.md`, ADR/domain yang relevan,
dan `docs/testing/DEFINITION_OF_DONE.md`. Untuk perubahan Community Checklist,
mulai dari ADR-031 dan cek kontrak API, migrasi, volume Docker, serta backup
scope secara bersamaan. Untuk lampiran postingan dan polling, mulai dari §1e lalu
`community-attachment.service.ts` — batas ukuran, penyapuan, dan pengikatan saat
publish semuanya di sana.

Sebelum deploy:

- jalankan lint, typecheck, build, dan test di container `node:22-alpine`;
- bila kontrak API berubah, jalankan `openapi:generate` lalu commit
  `apps/api/openapi.json` dan `packages/api-client/src/generated` bersama
  perubahannya — CI menjalankan `openapi:check` dan gagal bila keduanya melenceng.
  Perintah itu menuntut `DATABASE_URL`, `REDIS_URL`, dan `MFA_ENCRYPTION_KEY`
  (32 byte base64) meski tidak menyentuh basis data;
- `pnpm --filter @lms/web run typecheck` memakai `@lms/api-client` hasil build,
  bukan sumbernya. Sesudah regenerasi, jalankan
  `pnpm --filter @lms/api-client run build` lebih dulu atau typecheck-nya akan
  mengeluh tentang field yang sebenarnya sudah ada;
- pastikan migrasi baru tercatat dan checkpoint backup masih tersedia;
- **migrasi yang mengubah data, bukan skema, diuji dulu di basis data buangan.**
  Buat database sementara di `pg-test`, jalankan `prisma migrate deploy`, isi baris
  tiruan yang mewakili tiap kasus batas, jalankan UPDATE-nya di dalam transaksi,
  lalu `ROLLBACK`. Untuk baris produksi yang akan ditimpa dan tidak dapat
  direkonstruksi, simpan snapshot terarah di `/var/backups/lms-ai/pre-migration/`
  sebelum deploy — restore seluruh basis data terlalu mahal untuk membatalkan satu
  kolom;
- untuk deploy yang membawa migrasi, ambil checkpoint segar lebih dulu:
  `. /etc/lms-backup.env; LMS_APP_UUID=e1b4fo52n9tnzjpm5m2i5k8l lms-backup`.
  Checkpoint harian bisa tertinggal beberapa deployment, dan yang basi tidak
  berguna untuk membatalkan migrasi hari ini;
- deploy lewat Coolify, lalu jalankan `scripts/verify-deploy.sh`;
- periksa disk VPS dan status deployment queue; jangan mengulang deploy bila
  queue sebelumnya masih berjalan;
- sesudah deploy, buktikan perubahannya benar-benar terkirim, bukan sekadar
  container hidup: `grep` kelas CSS atau teks baru di dalam container `web`, field
  baru di `dist` container `api`, dan query ulang basis data untuk migrasi data.

Jangan menganggap angka snapshot di §1 sebagai data real-time. Jika keputusan
bergantung pada jumlah baris produksi, query ulang database produksi dengan
perintah di §2.

## 7. Bacaan lanjutan

| Untuk | Berkas |
|---|---|
| Peta seluruh dokumentasi | `docs/DOCUMENTATION_INDEX.md` |
| Aturan kerja agen | `AGENTS.md`, `CLAUDE.md` |
| Cadangan, restore, hasil drill | `docs/operations/BACKUP_RESTORE.md` |
| Deploy dan runbook VPS | `docs/operations/DEPLOYMENT.md`, `docs/operations/HOSTINGER_VPS_RUNBOOK.md` |
| Staging | `docs/operations/STAGING.md` |
| Variabel lingkungan | `docs/operations/ENVIRONMENT_VARIABLES.md` |
| Insiden | `docs/operations/INCIDENT_RESPONSE.md`, `docs/operations/incidents/` |
