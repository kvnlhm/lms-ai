# Status Proyek

Berkas ini ditulis untuk dibaca di awal sesi baru, oleh saya sendiri di hari
berikutnya atau oleh siapa pun yang melanjutkan. Isinya bukan arsitektur —
itu ada di `docs/DOCUMENTATION_INDEX.md` — melainkan tiga hal yang tidak
tersimpan di mana pun kecuali di kepala orang yang baru saja mengerjakannya:
keadaan produksi hari ini, apa yang sudah ditutup, dan apa yang sengaja
dibiarkan terbuka beserta alasannya.

Terakhir diperbarui: **8 Agustus 2026**, setelah tombol layar penuh pemutar
kursus dapat dipakai keluar juga, deployment **257** terverifikasi.

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
| Deploy terakhir | commit `a01c719`, deployment **242**, selesai dan terverifikasi |
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

## 1f. Gambar postingan berhenti terasa berat

8 Agustus 2026. Migrasi `20260808100000_community_attachment_dimensions`.

Diminta pemiliknya sesudah menanyakan apakah gambar perlu dipindahkan ke pihak
ketiga seperti video ke Bunny Stream. Jawabannya tidak: bebannya bukan bandwidth
melainkan tiga hal yang menumpuk, dan ketiganya diperbaiki di tempatnya sendiri.
CDN pihak ketiga dibiarkan sebagai langkah yang dapat menyusul kapan saja.

- **Gambar disimpan mentah.** `CommunityAttachmentService.simpan()` hanya
  memeriksa magic byte lalu menulis byte aslinya. Foto ponsel 5 MB dikirim utuh
  ke kartu selebar beberapa ratus piksel. Sekarang gambar diolah sambil
  mengalir: `autoOrient`, dikecilkan ke sisi terpanjang 1600, dikodekan ulang
  menjadi WebP mutu 82. Backfill dua berkas uji berukuran wajar menghasilkan
  10,53 MB → 1,54 MB. Batas unggahan 10 MB tidak berubah; yang berubah adalah
  apa yang mendarat di disk dan karenanya apa yang diunduh pembaca.
- **`Cache-Control: private, no-store`.** Gambar postingan tidak pernah boleh
  disimpan browser, jadi menggulir turun lalu naik mengunduh ulang semuanya.
  Sekarang `private, no-cache`: salinannya boleh tinggal, tetapi wajib
  divalidasi ulang, sehingga otorisasi tetap berjalan pada setiap permintaan
  dan yang hilang hanyalah pengiriman ulang bytenya. Ini melonggarkan kontrol
  yang tercatat di `SECURITY_CONTROLS.md`; diputuskan pemiliknya, dan alasannya
  ikut dicatat di sana.
- **Tidak ada dimensi.** `CommunityPostAttachment` kini menyimpan `width` dan
  `height` (nullable — video, PDF, dan lampiran lama tetap null), dan
  `post-attachments.tsx` memasangnya pada `<img>` sehingga ruang gambar sudah
  terpesan sebelum bytenya tiba.

Yang perlu diingat:

- **Header cache ada di dua tempat dan harus sama.** Blok `location
  /protected-community-attachments/` pada kedua template Nginx memasang ulang
  `Cache-Control` dan menimpa header dari upstream. Selama blok itu masih
  `no-store`, perubahan di controller NestJS tidak pernah sampai ke browser —
  dan e2e tetap hijau, karena supertest memukul NestJS langsung, bukan Nginx.
  Keduanya sudah disamakan; jangan mengubah salah satunya saja.
- **Backfill gambar lama** ada di
  `apps/api/scripts/backfill-community-attachment-images.mjs`. Aman diulang
  (baris ber-`width` dilewati) dan punya `--dry-run`.

  **Sudah dijalankan pada production 8 Agustus 2026: 111 gambar, 170,26 MB →
  9,47 MB.** Volume lampiran turun dari 242 MB ke 81 MB; sisanya sembilan video
  MP4 sebesar 71 MB yang memang tidak disentuh. Nol baris menunjuk berkas yang
  tidak ada, nol berkas yatim, nol gambar tanpa dimensi.

  Backfill pertama dijalankan **dari host**, bukan dari kontainer API: image
  yang berjalan saat itu dibangun sebelum `sharp` masuk ke `apps/api`, jadi
  skripnya belum dapat diimpor di sana. Sesudah deploy, kontainer sudah
  memilikinya dan sapuan berikutnya dijalankan dari dalam — itu cara yang benar
  untuk menjalankannya lagi nanti:
  `docker exec api-<uuid> sh -c 'cd /app/apps/api && node scripts/backfill-community-attachment-images.mjs'`.

  Catatan untuk memeriksa dependensi di kontainer: pnpm **tidak** meng-hoist ke
  `/app/node_modules`, jadi `ls node_modules/<paket>` di sana selalu menjawab
  tidak ada dan menyesatkan. Yang benar `node -e "require('<paket>')"` dari
  `/app/apps/api`.

  Cara menjalankan dari host, bila suatu saat perlu lagi:
  `DATABASE_URL` diambil dari `printenv` kontainer API dengan hostname docker
  diganti IP kontainer postgres, dan `COMMUNITY_ATTACHMENT_STORAGE_PATH`
  menunjuk `/var/lib/docker/volumes/e1b4fo52n9tnzjpm5m2i5k8l_community-attachment-data/_data`.
  API berjalan sebagai root dan berkasnya `root:root 0644`, sama dengan yang
  ditulis host, jadi tidak ada beda kepemilikan.

  Mutunya diperiksa sebelum yang asli dihapus, bukan sesudah. Isi produksi
  ternyata didominasi tangkapan layar, bukan foto ponsel — dan WebP lossy pada
  teks adalah tempat mutu biasanya jatuh. Potongan 1:1 dari kasus tipikal
  (0,92 MB → 44 KB) dan kasus paling ekstrem (5,95 MB → 0,12 MB, 50×)
  dibandingkan berdampingan: teks tetap tajam, tidak ada ringing, tekstur
  terjaga. `nearLossless` menghasilkan 459 KB untuk berkas yang sama — sepuluh
  kali lebih besar tanpa beda yang terlihat, jadi mutu 82 dipertahankan.
- Pengodean ulang membuang EXIF, termasuk koordinat GPS yang dibawa foto ponsel
  tanpa disadari pengunggahnya. Itu perbaikan privasi yang datang cuma-cuma,
  bukan efek samping yang perlu dibatalkan.
- **Sudah dideploy.** Commit `8a05a14`, deployment 243, 8 Agustus 2026.
  Terverifikasi pada runtime yang berjalan, bukan pada repo: `dist` kontainer
  API memuat `autoOrient().resize({...})`, controller terkompilasi memuat
  `private, no-cache` dua kali (lampiran postingan dan lampiran checklist), dan
  `nginx -T` di gateway mengembalikan `add_header Cache-Control "private,
  no-cache"` pada blok `/protected-community-attachments/`. Backfill dijalankan
  sekali lagi dari dalam kontainer sesudah deploy untuk menyapu gambar yang
  masuk di sela antara backfill pertama dan deploy: nol tersisa.
- **Blok `/protected-materials/` sengaja tetap `no-store`.** Ia melayani PDF
  materi pelajaran, bukan lampiran komunitas, dan `lesson-material.e2e-spec.ts`
  menguncinya. Jangan ikut diubah hanya karena letaknya bersebelahan.

---

## 1g. Thumbnail kursus dan foto profil ikut diolah

8 Agustus 2026, menyusul 1f. Tanpa migrasi.

Lampiran komunitas selesai, tetapi dua jalur unggah gambar lain masih menyimpan
mentah — masalah yang sama persis, di tempat lain. Halaman katalog memuat
seluruh kursus sekaligus, jadi 32 thumbnail sebesar 24 MB adalah 24 MB yang
diunduh dalam satu kali buka.

- Keputusan tentang format kini berada di satu tempat: `shared/storage/image-processing.ts`
  mengekspor `olahGambar(sisiMaks)`, dan ketiga service memakainya. Sebelumnya
  pipeline sharp ditulis inline di lampiran komunitas.
- Thumbnail kursus dikecilkan ke sisi terpanjang **1200**, foto profil ke
  **256**. Avatar tampil 29–40 piksel di kartu postingan, jadi 256 sudah longgar
  untuk layar 3x.
- Nama berkas keduanya kini selalu `.webp`. Regex `open()` dan `removePrevious()`
  sudah menerima `webp` sejak semula, jadi tidak ada yang perlu diubah di sana.
- Field `extension` pada tabel `TYPES` kedua service menjadi mati dan dibuang;
  yang menentukan ekstensi bukan lagi jenis unggahannya.

Yang perlu diingat:

- **Dua e2e mengunci perilaku lama dan ikut disesuaikan.**
  `course-authoring.e2e-spec.ts` dan `auth.e2e-spec.ts` mengunggah "PNG" berupa
  magic byte ditambah teks, lalu menuntut berkas itu tersimpan byte demi byte.
  Sesudah pengodean ulang, isi semacam itu memang ditolak — keduanya kini
  memakai PNG sungguhan dan menuntut keluaran WebP pada dimensi yang benar.
  Kalau suatu saat keduanya merah lagi dengan 422, periksa dulu apakah
  fixture-nya gambar sungguhan.
- **Backfill** ada di `apps/api/scripts/backfill-profile-and-thumbnail-images.mjs`,
  terpisah dari backfill lampiran karena keduanya dirujuk lewat kolom URL
  (`courses.thumbnail_url`, `users.avatar_url`), bukan kunci objek. Punya
  `--dry-run`.

  **Ekstensi bukan tanda "sudah diolah".** Versi pertama skrip ini menyaring
  dengan `endsWith('.webp')` dan melewatkan justru berkas yang paling perlu
  diolah: kode lama menyimpan unggahan WebP apa adanya, sehingga ada thumbnail
  `.webp` sebesar 792 KB pada 1024×717 — dua puluh kali hasil olahan pada
  dimensi yang sama, dan 40% dari seluruh volume sesudah backfill pertama.
  Ketahuan saat memeriksa berkas terbesar yang tersisa, bukan dari skripnya
  sendiri, yang melaporkan sukses.

  Sekarang penggantinya diputuskan dari hasil, bukan dari nama: berkas baru
  dipakai bila dimensinya berubah atau ukurannya turun di bawah 80% aslinya.
  Itu sekaligus yang membuatnya aman diulang — mengolah ulang berkas yang sudah
  mutu 82 menghasilkan ukuran yang nyaris sama sehingga ditolak sendiri, jadi
  tidak ada kompresi berulang yang menggerus mutu tiap kali dijalankan.

  Hasil production 8 Agustus 2026: thumbnail **24 MB → 1,2 MB** (32 berkas),
  avatar **196 KB → 20 KB**. Nol baris menunjuk berkas yang tidak ada, nol
  yatim.

  Perbaikan skrip ini datang sesudah deployment 244, jadi salinan di dalam
  kontainer masih versi lama sampai deploy berikutnya. Untuk sekarang jalankan
  dari host bila perlu.

---

## 1h. Masuk dan mendaftar dengan akun Google

8 Agustus 2026. Commit `a1b71b1`, deployment 246. Migrasi
`20260808120000_google_identity`.

Diminta pemiliknya, yang menyebut sendiri bahwa ia bingung karena pendaftaran
terikat pembayaran. Kebingungan itu beralasan: di sistem ini **pendaftaran sama
dengan pembelian**, akun baru lahir dari webhook Midtrans, dan tidak ada akun
gratis sama sekali. Jadi "daftar via Google" harus menjawab pertanyaan yang
selama ini tidak perlu dijawab — apa yang terjadi bila seseorang masuk dengan
Google tetapi belum membayar.

Keputusan pemiliknya, ditegaskan dua kali: **selama belum membayar, tidak boleh
masuk.** Google dipakai sebagai bukti identitas, bukan sebagai pintu akses.

- `POST /auth/google` **tidak pernah memanggil `user.create`.** Tidak adanya
  akun yang cocok berarti orangnya memang belum membayar, dan jawabannya 401.
- Sesudah identitasnya terbukti, jalurnya menyatu ke `terbitkanSesi()` yang
  sama dengan masuk memakai kata sandi. Itu disengaja: pemeriksaan status,
  role, dan MFA hanya ada di satu tempat, sehingga pintu Google tidak dapat
  diam-diam menjadi lebih longgar daripada pintu satunya.
- Pada checkout, kehadiran ID token membuat **email dan nama diambil dari
  token, bukan dari formulir**. Tanpa itu seseorang dapat masuk dengan akun
  Google sendiri lalu mengetikkan email orang lain, dan webhook pembayaran akan
  menautkan `googleSub` penyerang ke akun berbayar milik orang itu. Nomor
  telepon tetap dari formulir; Google tidak memberikannya sedangkan aktivasi
  WhatsApp membutuhkannya.
- Penautan ke akun berbayar yang sudah ada dilakukan lewat email, dan itu hanya
  aman karena token yang `email_verified`-nya bukan `true` ditolak lebih dulu.
  Jangan pernah melonggarkan pemeriksaan itu.

Yang perlu diingat:

- **Client id dibaca Server Component saat permintaan datang, bukan
  `NEXT_PUBLIC_*`.** Halaman login dan pendaftaran ber-`force-dynamic`,
  jadi keduanya membaca `GOOGLE_OAUTH_CLIENT_ID` lalu meneruskannya sebagai
  prop. Konsekuensinya baik: mengganti client id **tidak** menuntut rebuild.
  Polanya sama dengan kunci publik Midtrans yang sudah dikirim saat runtime.
- **Kosong berarti mati, dan matinya fail closed.** Tanpa client id, seluruh
  token ditolak — bukan diterima tanpa pemeriksaan. Tanpa `audience` yang
  benar, token terbitan aplikasi Google mana pun akan lolos.
- Alurnya memakai ID token, bukan authorization code. Tidak ada redirect URI,
  tidak ada callback, dan tidak ada client secret di mana pun. Di Google Cloud
  Console hanya **Authorised JavaScript origins** yang diisi
  (`https://academy.aipreneur.co.id`); kolom redirect dibiarkan kosong.
- Consent screen harus berstatus **Published**, bukan Testing. Selama Testing,
  hanya akun yang didaftarkan manual sebagai test user yang diterima Google.

Terverifikasi di produksi, bukan hanya di test: tombolnya render di
`/login` dan `/register` (artinya Google menerima client id dan origin-nya,
karena origin yang tidak diizinkan membuat GSI menolak render), console bersih,
dan `POST /auth/google` dengan token palsu membalas 401 tanpa menambah satu pun
baris `users`.

Dua cacat tampilan menyusul, keduanya hanya terlihat di halaman sungguhan dan
dilaporkan pemiliknya lewat tangkapan layar (diperbaiki pada `9ae1acc`,
deployment 247):

- **Tombol Google tidak ikut tema.** Ia selalu dirender varian `outline` yang
  berlatar putih, sedangkan tema bawaan proyek gelap. Sekarang mengikuti tema —
  `filled_black` saat gelap, `outline` saat terang, `shape: 'pill'` menyamai
  `--r-pill`. Tombolnya hidup di dalam **iframe milik Google**, jadi ia tidak
  ikut berubah saat tema diganti; `data-theme` pada elemen root diamati
  `MutationObserver` dan tombolnya dirender ulang. Wadahnya harus dikosongkan
  lebih dulu — `renderButton` **menambahkan**, bukan mengganti, jadi tanpa itu
  berganti tema meninggalkan dua tombol bertumpuk. Sudah diuji dengan menekan
  tombol temanya: jumlah iframe tetap satu.
- **`.notice` adalah `display:flex`.** Anak inline apa pun di dalamnya menjadi
  flex item tersendiri dengan jarak 12px, sehingga satu kalimat terpecah
  menjadi kolom-kolom dan alamat email patah di tengah kata. Yang menaruh teks
  campuran di dalam `.notice` harus membungkusnya dalam satu elemen lebih dulu.
- `/register` **tidak punya tombol tema**, jadi ia murni mengikuti
  `prefers-color-scheme`. Untuk mengujinya di browser otomatis:
  `agent-browser set media dark`.
- **Tombol Google terpotong di sisi kanan karena reset CSS kita sendiri, bukan
  karena Google.** `styles.css` baris 201 memasang
  `img, video, canvas, iframe { max-width: 100% }`. Google merender tombolnya
  pada iframe selebar **233 px** dengan `margin: -2px -10px` — 10 px transparan
  di tiap sisi yang ditarik masuk lagi oleh margin negatif itu. Induknya
  menyusut ke 213 px, `max-width` memangkas iframe-nya ke angka itu, dan karena
  margin kirinya negatif seluruh 20 px yang hilang jatuh di sisi kanan. Ujung
  membulat tombolnya terpotong rata. Perbaikannya satu baris:
  `.googleSignIn iframe{max-width:none}` (`1bdb0cd`).

  **Empat percobaan sebelumnya keliru karena menyangka Google yang membatasi.**
  Urutannya: 320 px terpotong → patokan **dibuang** (`04b9ceb`), yang justru
  membuat Google memakai ukuran terkecil 211 px sehingga makin parah →
  dinaikkan ke maksimum 400 (`cdde8f3`), masih terpotong → varian personalisasi
  dimatikan lewat `width: 199` (`ff0ff2f`), tombolnya jadi standar tetapi
  ujungnya tetap rata. Baru pemeriksaan `getComputedStyle` pada iframe-nya —
  yang menunjukkan lebar diminta 233 px tetapi terhitung 213 px — menemukan
  sebab sesungguhnya. **Pelajarannya: ukur elemennya, jangan menalar dari
  dokumentasi vendor saja.**

- **`width: 199` tetap dipertahankan**, yang membuat Google memakai tombol
  standar dan bukan varian personalisasi (ambangnya 200 menurut dokumentasi
  Google). Varian itu kemungkinan besar ikut sembuh oleh perbaikan `max-width`
  di atas, karena gejalanya sama persis — terpotong 20 px di kanan. Belum
  dicoba mengaktifkannya kembali; kalau diinginkan, naikkan angka itu ke 400.
  Varian personalisasi tidak dapat direproduksi di browser otomatis, jadi
  perubahan itu hanya dapat diverifikasi pemiliknya.
- **Varian personalisasi tidak dapat direproduksi di browser otomatis.** Ia
  hanya muncul bila pengunjung punya sesi Google aktif **dan** pernah masuk ke
  situs ini, sehingga setiap pemeriksaan di sini selalu memperoleh varian
  standar. Cacat yang hanya menimpa varian itu — seperti terpotongnya tombol di
  atas — hanya terlihat lewat tangkapan layar pemiliknya. Kalau ada laporan
  serupa lagi, jangan menganggapnya tidak terbukti hanya karena pengujian
  otomatis bersih.

---

## 1i. Video postingan komunitas pindah ke Bunny Stream

8 Agustus 2026. Deployment 255. Migrasi `20260808140000_community_video_via_bunny`.

Diminta pemiliknya sesudah menyadari video lampiran komunitas tidak pernah
ditranscode. Pemeriksaan menemukan kesembilan video di production kebetulan
sudah H.264 dan `moov`-nya di depan, jadi belum ada yang rusak — tetapi
validasinya hanya memeriksa `ftyp`, dan MP4 berisi HEVC punya tanda tangan yang
sama persis. Pengunggah dari iPhone akan lolos lalu videonya gagal diputar
diam-diam di Chrome desktop, tanpa pesan apa pun.

Dipilih Bunny, bukan transcode sendiri: transcoding memakan CPU berat di VPS
yang sama dengan API, worker, dan database — persis beban yang dulu mendorong
video kursus pindah ke sana.

Kendala yang ditetapkan pemiliknya: **jangan ganggu tampilan pengguna.** Itu
menentukan urutan kerjanya, dan urutan itu tidak boleh dibalik:

1. jalur baca lebih dulu, sehingga klien dapat menampilkan kedua jenis lampiran;
2. deploy dan buktikan;
3. baru pindahkan video lama.

Memindahkan lebih dulu berarti klien belum tahu cara menampilkan lampiran
ber-Bunny, dan postingan yang sedang tayang rusak.

Yang perlu diingat:

- **`objectKey` kini nullable, dengan constraint `satu_sumber`** yang menjamin
  tepat satu sumber isi per lampiran: berkas milik kita, atau aset video di
  penyedia. Constraint itu juga yang memaksa pemindahan bersifat atomik — tidak
  mungkin ada baris yang setengah pindah. Sudah dibuktikan menolak di production.
- **Komunitas tidak menyentuh `BunnyStreamClient`.** Yang menyeberang batas
  modul adalah `VIDEO_PROVISIONER`, port yang bentuknya tidak menyebut penyedia
  mana pun (ADR-013).
- **Penyelarasan status menumpang di jalur baca komunitas.**
  `segarkanAsetBunnyTertunda()` milik modul video hanya berjalan saat
  perpustakaan admin dibuka — tidak ada Pelajar yang membukanya, jadi tanpa ini
  video postingan tercatat PROCESSING selamanya. Dibatasi sepuluh aset per
  pembacaan.
- **Video kini dihapus dari penyedia.** Sebelumnya tidak pernah, bahkan untuk
  video kursus. Untuk kursus yang sedikit dan dikurasi itu dapat diabaikan;
  untuk lampiran komunitas yang diunggah siapa saja, draf yang ditinggalkan
  menumpuk dan terus ditagih. Seluruh jalur penghapusan lewat satu pintu
  `buangIsi`. Dua jalur nyaris terlewat: `remove()` checklist, dan `replace()`
  yang dulu hanya mengembalikan kunci berkas sehingga video yang dibuang saat
  **menyunting** postingan tertinggal di penyedia.
- **Sembilan video lama sengaja belum dipindah** dan masih diputar dari volume
  kita. Skrip pemindahannya belum ada; urutannya unggah ke Bunny → tunggu siap →
  tukar dalam satu update → baru hapus berkas lokal.
- Biaya: setiap video yang diunggah Pelajar masuk library Bunny dan ditagih.
  Pagarnya batas 10 MB per berkas dan 10 draf menggantung per orang.

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

**Environment variable Coolify disimpan terenkripsi. Jangan pernah menulisnya
lewat SQL langsung.** Menyisipkan baris teks biasa ke `environment_variables`
membuat `decrypt()` Laravel melempar `DecryptException` saat build, dan yang
gagal bukan variabel itu saja melainkan **seluruh deploy** (kejadian nyata:
deployment 245). Produksi tidak ikut jatuh karena kegagalannya di tahap build,
tetapi tidak ada deploy yang bisa lewat sampai barisnya dibuang. Yang benar
lewat modelnya:

```bash
docker exec coolify php artisan tinker --execute="\$app = App\Models\Application::where('uuid','e1b4fo52n9tnzjpm5m2i5k8l')->firstOrFail(); App\Models\EnvironmentVariable::updateOrCreate(['key'=>'NAMA','resourceable_id'=>\$app->id,'resourceable_type'=>App\Models\Application::class],['value'=>'nilai','is_runtime'=>true,'is_buildtime'=>true,'is_preview'=>false]);"
```

Perhatikan `\$` yang di-escape: tanpa itu bash mengganti `$app` menjadi kosong
sebelum sampai ke PHP, dan perintahnya gagal tanpa pesan yang jelas.

Baris ganda untuk satu kunci adalah hal normal di instalasi ini — `WEB_URL` dan
`MIDTRANS_ENVIRONMENT` pun begitu. Selama nilainya sama, tidak ada masalah.

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
15. **Hapus kursus tersedia dari daftar, bukan hanya dari editornya** — `bf1373c`,
    deployment 256. Di luar backlog, datang dari laporan pemiliknya.

    Endpoint dan audit log-nya sudah ada sejak awal; yang hilang hanya tombolnya
    di `/master/courses`, sehingga membuang satu kursus menuntut membukanya lebih
    dulu. Konfirmasi, permintaan hapus, dan tawaran hapus paksa saat server
    menolak 409 dipindahkan ke `apps/web/app/master/courses/hapus-kursus.tsx`
    yang dipakai daftar maupun editor — peringatan sekeras itu tidak boleh punya
    dua salinan yang dapat menyimpang diam-diam. Yang terjadi sesudahnya sengaja
    berbeda: editor berpindah karena halamannya ikut hilang, daftar memuat ulang
    dirinya.
16. **Tombol layar penuh pemutar kursus kini dua arah** — `8165ab9`, deployment
    257. Juga dari laporan pemiliknya.

    Tombolnya hanya pernah memanggil `requestFullscreen`, jadi klik kedua
    meminta hal yang sama pada elemen yang sudah berada di sana dan tidak
    terjadi apa-apa; satu-satunya jalan keluar adalah Escape, yang tidak
    disebutkan di mana pun dan tidak ada di ponsel. Keadaannya kini dibaca dari
    `fullscreenchange`, bukan dicatat saat tombol ditekan — Escape dan tombol
    layar penuh milik browser keluar tanpa melewati tombol kita.

    Belum ditutup: di iPhone, Safari tidak punya `requestFullscreen` untuk
    elemen biasa, sehingga penjaganya membuat tombol itu diam saja di sana.
    Perlu `webkitEnterFullscreen` pada elemen `<video>`, dengan konsekuensi
    kontrol kita digantikan kontrol bawaan iOS.

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
- **Paket `uji-internal-wa` "Uji Internal" Rp10.000 sengaja aktif dan sengaja
  tampil di `/api/v1/registration/tiers`.** Pemiliknya memakainya untuk mencoba
  alur pembayaran sungguhan di Midtrans Production. Dikonfirmasi 8 Agustus 2026
  sesudah dilaporkan sebagai temuan. Jangan dinonaktifkan dan jangan diangkat
  lagi sebagai celah.

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
