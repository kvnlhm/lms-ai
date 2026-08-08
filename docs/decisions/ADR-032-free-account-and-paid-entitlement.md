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

### 8. Pendaftaran gratis berdiri sendiri, bukan checkout berharga nol

`POST /api/v1/auth/free-registrations` membuat akun tanpa menyentuh
`registration_orders` sama sekali.

Paket Rp 0 lewat alur checkout yang sudah ada tampak jalan termudah dan justru
membatalkan seluruh keputusan di atas: ia melahirkan `RegistrationOrder`
berstatus `PAID`, dan pesanan `PAID` itulah definisi anggota berbayar pada
bagian 1 — setiap pendaftar gratis akan memperoleh akses penuh.

### 9. Materi contoh menuntut alamat email yang terbukti

Pendaftar gratis dapat masuk seketika, tetapi `is_preview` baru terbuka setelah
tautan pembuktian ditekan. Tanpa itu pendaftaran gratis dapat dipanen massal
dengan alamat yang tidak pernah dimiliki siapa pun, dan setiap panenan
memperoleh materi contoh secara utuh.

Penolakannya `403 EMAIL_NOT_VERIFIED`, dan pertanyaannya diajukan **hanya** pada
cabang itu — anggota berbayar sudah terbukti sejak alamatnya menerima tautan
aktivasi, sehingga tidak pernah menanggung biaya kueri tambahan.

Status verifikasi ditanyakan langsung ke basis data lewat port
`EMAIL_VERIFICATION_STATUS`, bukan dititipkan ke payload sesi. Sesi ini opaque
dan berumur panjang; menyalin status ke dalamnya berarti orang yang baru saja
menekan tautan verifikasi tetap ditolak sampai ia masuk ulang.

### 10. Pintu gratis diletakkan di bawah tombol bayar

Halaman `/register` tetap menjual paket berbayar seperti sebelumnya. Jalan
gratis muncul sebagai satu baris di bawah tombolnya, bukan sebagai kartu setara
di kepala halaman.

Keputusan penjualan, bukan keputusan teknis, dan diambil Product Owner: yang
sudah siap membayar tidak perlu ditawari alternatif, sedangkan yang ragu tetap
menemukan sesuatu selain menutup tab.

## Konsekuensi

- Migrasi menambah tabel `manual_access_grants`. Tidak ada kolom baru pada `users`
  dan tidak ada backfill.
- `pelajar.testing@aipreneur.co.id` hidup di produksi tanpa pesanan berbayar,
  sehingga menjadi akun gratis begitu penegakan menyala. Product Owner memutuskan
  membiarkannya demikian: satu akun gratis sungguhan di produksi lebih berguna
  untuk memeriksa perilakunya daripada satu baris grant.
- `MEMBERSHIP_REQUIRED` masuk `ERROR_CODES`, sehingga kontrak API berubah dan
  klien OpenAPI ikut diregenerasi.
- Penegakan dikerjakan dan dirilis **lebih dulu** (deployment 267), pendaftaran
  gratis menyusul. Urutan sebaliknya melahirkan akun yang langsung memperoleh
  akses permanen ke seluruh kursus — lubang yang justru sedang ditutup.
- `EMAIL_NOT_VERIFIED` menyusul masuk `ERROR_CODES`, dan
  `CredentialTokenPurpose` memperoleh nilai `EMAIL_VERIFICATION`.
- Belum ada antarmuka Master untuk membuat `manual_access_grants`. Selama itu
  belum ada, pembeli di luar Midtrans hanya dapat diberi akses lewat SQL — dan
  itu pekerjaan berikutnya yang paling mendesak.
- Selama belum ada satu pun pelajaran bertanda `is_preview`, akun gratis melihat
  kurikulum penuh tanpa dapat membuka apa pun. Penawaran gratisnya baru punya
  daya tarik setelah Master menandai materi contohnya.

## Alternatif yang ditolak

- **Kolom `users.membership`** — dua sumber kebenaran, perlu backfill, dan tidak
  menangani kedaluwarsa tanpa pekerjaan terjadwal.
- **Role `FREE`** — mencampur peran (siapa dia) dengan hak beli (apa yang dia
  bayar). Role di sistem ini menentukan permission, dan akun gratis tidak berbeda
  permission-nya dari pelajar berbayar.
- **Akun gratis tanpa isi sama sekali** — lebih sederhana ditegakkan, tetapi
  menghapus satu-satunya cara calon pembeli menilai materinya.
