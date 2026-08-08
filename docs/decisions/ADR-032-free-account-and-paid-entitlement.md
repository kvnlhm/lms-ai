# ADR-032 — Akun Gratis dan Hak Akses Berbayar

- Status: Accepted
- Tanggal: 8 Agustus 2026
- Pemilik keputusan: Product Owner
- Menggantikan: —
- Terkait: ADR-009, ADR-013

## Konteks

Sampai hari ini akun **adalah** tiket masuk. `EnrollmentAccessService.ensureCourseAccess`
menyatakannya terang-terangan: setiap pengguna terautentikasi memperoleh akses
permanen ke setiap kursus yang sudah terbit, dan baris enrollment dibuat begitu
kursusnya disentuh. Tidak ada gerbang per kursus maupun per pelajaran.

Yang menjaga isi kursus bukan otorisasi, melainkan pintu pendaftaran: satu-satunya
cara memperoleh akun adalah `POST /api/v1/registration/checkout` → Midtrans →
webhook membuat akunnya. Membayar dan mendaftar adalah peristiwa yang sama.

Product Owner memutuskan membuka pendaftaran gratis: siapa pun boleh membuat akun,
melihat katalog dan daftar bagian/pelajaran, tetapi tidak membuka isi pelajaran dan
tidak menulis di komunitas. Akses gratis berlaku selamanya, bukan masa coba.

Keputusan itu membalik asumsi yang menopang seluruh modul akses. Begitu akun dapat
diperoleh tanpa bayar, setiap keputusan akses harus benar-benar ditegakkan — dan
sekarang belum ada satu pun yang ditegakkan.

## Keputusan

### 1. Keanggotaan berbayar diturunkan, tidak disimpan sebagai status

Tidak ada kolom `membership` pada `users` dan tidak ada role ketiga. Seseorang
berstatus anggota berbayar bila **salah satu** benar:

- ada `registration_orders` miliknya berstatus `PAID` yang `access_ends_at`-nya
  kosong atau masih di depan; atau
- ada `manual_access_grants` miliknya yang `granted_until`-nya kosong atau masih
  di depan.

Alasannya: pesanan sudah menjadi catatan siapa membayar dan sampai kapan, lengkap
dengan kedaluwarsanya. Menyalin kesimpulannya ke kolom lain menciptakan dua sumber
kebenaran yang pasti berselisih pada kasus yang paling mahal — keanggotaan yang
baru habis, atau pembayaran yang baru masuk.

### 2. Pemberian akses manual memakai tabelnya sendiri

`manual_access_grants` menampung akses yang diberikan Master di luar Midtrans:
pembeli via transfer bank, staf, akun uji. Kolomnya menyimpan siapa yang memberi
dan alasannya.

Tabel tersendiri, **bukan** `registration_orders` ber-`payment_provider = MANUAL`,
karena pemberian akses bukan penjualan. Menaruhnya di tabel pesanan membuat setiap
laporan pendapatan menghitung barang yang tidak pernah dibeli, dan laporan itu yang
dipakai pemiliknya mengambil keputusan.

Tabelnya milik modul commerce, sejalan dengan `registration_orders`.

### 3. Pertanyaan keanggotaan dilintasi lewat port

`MEMBERSHIP_ACCESS` diumumkan di `src/shared/access/membership.port.ts` dan
diimplementasikan `MembershipAccessService` milik commerce. Modul enrollment,
community, dan forum menanyakan lewat port itu dan tidak pernah membaca
`registration_orders` maupun `manual_access_grants` (AGENTS.md bagian 6).

Portnya tinggal di `shared/` alih-alih di salah satu pemanggil, karena
pemanggilnya tiga. Pola `COURSE_PREVIEW_ACCESS` menaruh port di pemanggil ketika
pemanggilnya satu; menggandakan interface yang sama tiga kali bukan penerapan pola
itu, melainkan pengulangannya.

### 4. Gerbang isi pelajaran memakai `lessons.is_preview`

Kolom `is_preview` sudah ada di skema dan togelnya sudah ada di editor Master, tetapi
belum pernah ditegakkan di mana pun. Kolom itulah yang kini menentukan: akun gratis
boleh membuka pelajaran ber-`is_preview`, dan ditolak pada yang lain.

Master yang menentukan pelajaran mana menjadi contoh. Alternatif "pelajaran pertama
tiap kursus" ditolak karena pelajaran pertama sering pembuka yang tidak menjual.

Penolakannya `402 MEMBERSHIP_REQUIRED`, bukan `403`. Web memakai status itu untuk
mengarahkan ke halaman bayar, dan `403` sudah dipakai untuk penolakan yang tidak
dapat diselesaikan dengan membayar.

### 5. Penyusun kursus lolos gerbang isi

Pemegang `courses.manage` tidak terkena gerbang ini. Mereka sudah boleh melihat
kursus yang belum terbit lewat `COURSE_PREVIEW_ACCESS`; gerbang yang menahan mereka
pada kursus yang **sudah** terbit akan membuat Master tidak dapat memeriksa
materinya sendiri.

Karena itu akun Master tidak memerlukan baris `manual_access_grants`.

### 6. Komunitas dan forum: akun gratis membaca, tidak menulis

Membuat postingan, mengomentari, bereaksi, memilih pada jajak pendapat, membuka
topik forum, dan membalasnya menuntut keanggotaan berbayar. Membaca tidak.

Komunitas yang tertutup rapat tidak dapat menjadi alasan seseorang membayar.

### 7. Akun gratis tidak memperoleh baris enrollment

`ensureCourseAccess` tidak lagi membuat enrollment untuk yang bukan anggota
berbayar, dan progres pada pelajaran pratinjau tidak dicatat.

Alasannya angka: `enrollments` adalah dasar kolom "Terdaftar" di daftar kursus
Master dan dasar seluruh analitik. Membiarkan akun gratis membuat baris di sana
membuat angka itu berhenti berarti "pelajar berbayar" tanpa satu pun tanda bahwa
artinya sudah berubah. Pratinjau adalah contoh barang, bukan bagian dari riwayat
belajar seseorang.

## Konsekuensi

- Migrasi menambah tabel `manual_access_grants`. Tidak ada kolom baru pada `users`
  dan tidak ada backfill.
- `pelajar.testing@aipreneur.co.id` hidup di produksi tanpa pesanan berbayar dan
  akan menjadi akun gratis begitu penegakan menyala. Baris grant dibuat terarah
  sesudah deploy; emailnya tidak ditulis ke dalam migrasi karena repositori ini
  publik.
- `MEMBERSHIP_REQUIRED` masuk `ERROR_CODES`, sehingga kontrak API berubah dan
  klien OpenAPI ikut diregenerasi.
- Penegakan dikerjakan dan dirilis **lebih dulu**, pendaftaran gratis menyusul.
  Urutan sebaliknya melahirkan akun yang langsung memperoleh akses permanen ke
  seluruh kursus — lubang yang justru sedang ditutup.

## Alternatif yang ditolak

- **Kolom `users.membership`** — dua sumber kebenaran, perlu backfill, dan tidak
  menangani kedaluwarsa tanpa pekerjaan terjadwal.
- **Role `FREE`** — mencampur peran (siapa dia) dengan hak beli (apa yang dia
  bayar). Role di sistem ini menentukan permission, dan akun gratis tidak berbeda
  permission-nya dari pelajar berbayar.
- **Akun gratis tanpa isi sama sekali** — lebih sederhana ditegakkan, tetapi
  menghapus satu-satunya cara calon pembeli menilai materinya.
