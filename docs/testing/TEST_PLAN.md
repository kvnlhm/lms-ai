# Test Plan

## 1. Objectives

Memastikan LMS:

- Memenuhi PRD.
- Menjaga permission dan data isolation.
- Menyimpan progress secara konsisten.
- Tetap berfungsi ketika analytics, email, atau AI gagal.
- Dapat di-deploy dan di-rollback.
- Memiliki performa sesuai target.

---

## 2. Test Levels

## 2.1 Unit Test

Target:

- Domain rule.
- Value object.
- Progress calculation.
- Enrollment transition.
- Risk score.
- Permission mapping.
- Event payload.

Tidak menggunakan network atau database nyata.

## 2.2 Integration Test

Target:

- Prisma dan PostgreSQL.
- Redis session.
- BullMQ.
- Transactional outbox.
- Object storage adapter.
- Email adapter.
- AI client contract.

Gunakan container atau isolated test service.

## 2.3 API Test

Target:

- Authentication.
- Validation.
- Authorization.
- Error format.
- Pagination.
- Idempotency.
- Rate limiting.
- OpenAPI compliance.

## 2.4 Component Test

Target:

- Form.
- Learning player state.
- Progress UI.
- Dashboard card.
- Forum composer.
- Permission-aware UI.

## 2.5 End-to-End Test

Critical journey:

1. Master login dengan MFA.
2. Master membuat dan publish course.
3. Master enroll Student.
4. Student login.
5. Student membuka lesson.
6. Student complete lesson.
7. Course progress berubah.
8. Outbox event diproses.
9. Analytics read model ter-update.
10. Master melihat insight.

## 2.6 Architecture Test

Memastikan:

- Next.js tidak import database package.
- Domain tidak import NestJS presentation atau Prisma.
- Module tidak mengakses repository private module lain.
- Circular dependency tidak ada.
- Worker menggunakan application contract.
- AI service tidak memiliki akses authority data.

## 2.7 Security Test

- IDOR.
- Role bypass.
- CSRF.
- Session fixation.
- Session revocation.
- Brute-force control.
- XSS.
- Malicious upload.
- CSV injection.
- Signed URL access.
- Secret leakage.
- AI data minimisation.

## 2.8 Performance Test

Scenario:

- Login burst.
- Course catalogue read.
- Lesson open.
- Concurrent lesson completion.
- Master dashboard.
- Discussion list.
- Report request.
- Queue analytics burst.

Target awal:

- Core API p95 < 500 ms.
- Lesson completion p95 < 1 second.
- Analytics dashboard p95 < 2 seconds.
- Error rate < 1% pada designed load.
- No progress loss atau duplicate completion.

---

## 3. Critical Business Cases

| Test | Expected |
|---|---|
| Duplicate enrollment | Conflict, tidak membuat row kedua |
| Completion request diulang | Response konsisten, progress tidak bertambah ganda |
| Dua completion concurrent | Progress tetap benar |
| Optional lesson selesai | Tidak mengubah required percentage secara salah |
| Pengguna login tanpa enrollment | Enrollment progres dibuat otomatis dan lesson terbit dapat dibuka |
| Enrollment expired/removed | Diaktifkan otomatis tanpa menghapus progres dan lesson terbit dapat dibuka |
| Pengguna tanpa sesi | Course, lesson, dan playback tetap ditolak |
| Course archived | Existing history tetap tersedia sesuai rule |
| Student A meminta progress B | Ditolak tanpa data leakage |
| Master tanpa export permission | Ditolak |
| Outbox publish gagal | Business transaction tetap benar dan event dapat retry |
| Analytics terlambat | Progress tetap tampil benar |
| Worker memproses event dua kali | Aggregate tidak ganda |
| AI service down | Core LMS tetap berfungsi |
| Pelajar membaca kuis sebelum mengirim | Respons tidak memuat `isCorrect` sama sekali |
| Pelajar menandai selesai pelajaran kuis | Ditolak; hanya kelulusan yang menyelesaikannya |
| Percobaan kuis melebihi batas | Ditolak server, bukan hanya disembunyikan di UI |
| Pilihan jawaban milik soal lain dikirim | Ditolak `422`, bukan dinilai salah |
| Master menghapus soal yang sudah dijawab | Ditolak; riwayat percobaan tetap utuh |
| Kursus dengan pelajaran kuis tanpa soal | Tidak dapat diterbitkan |

---

## 4. Test Data

- Gunakan factory.
- Gunakan synthetic user.
- Jangan menggunakan production dump.
- Seed:
  - Master.
  - Student aktif.
  - Student suspended.
  - Course draft.
  - Course published.
  - Enrollment active.
  - Enrollment expired untuk pengujian reaktivasi otomatis.
  - Required dan optional lesson.
  - Discussion open dan locked.

---

## 5. CI Gates

Pull request tidak dapat merge jika:

- Lint gagal.
- Type check gagal.
- Unit test gagal.
- Integration test critical gagal.
- OpenAPI stale.
- Prisma migration invalid.
- Secret scan gagal.
- Critical dependency vulnerability ditemukan.
- Architecture test gagal.

---

## 6. Release Gates

Production release memerlukan:

- Critical E2E lulus.
- Security finding Critical = 0.
- High finding memiliki mitigation.
- Migration rehearsal lulus.
- Backup tersedia.
- Rollback procedure tersedia.
- Smoke test staging lulus.

## 7. Bunny Stream Test Cases

### Upload

- Authorised Master dapat membuat upload intent.
- Student ditolak.
- Master tanpa course permission ditolak.
- MIME dan ukuran invalid ditolak.
- API key tidak muncul di response atau log.

### Registrasi video Bunny

- GUID diambil dari GUID telanjang maupun dari tautan yang memuatnya; masukan
  tanpa GUID sah ditolak `422` tanpa memanggil Bunny.
- Selama `BUNNY_STREAM_LIBRARY_ID` atau `BUNNY_STREAM_API_KEY` kosong, endpoint
  menjawab `422` dan menyebut bahwa Bunny belum dikonfigurasi.
- Video yang sama tidak dapat didaftarkan dua kali.
- Verifikasi GUID ke API Bunny tidak dijalankan otomatis dalam test, karena
  menuntut panggilan keluar; hanya jalur penolakannya yang tercakup.

### Webhook

- Webhook valid memperbarui status.
- Webhook invalid ditolak.
- Replay event idempotent.
- Unknown provider video ID ditangani aman.
- Processing failure menghasilkan status `FAILED`.

### Playback

- Pengguna terautentikasi memperoleh short-lived URL untuk video pada course terbit; enrollment progres dibuat otomatis bila belum ada.
- Pengguna tanpa sesi, suspended account, locked lesson, course non-published, dan processing video ditolak.
- Aset Bunny dijawab `kind: HLS` dengan URL playlist CDN bertanda tangan dan
  `embedUrl` null; endpoint konten tidak melayaninya.
- URL playlist Bunny ditandatangani sha256 + base64url, dan tanda tangannya
  berubah ketika batas waktunya berubah. Nilai tetapnya dipatok pada unit test
  karena tanda tangan yang salah bentuk hanya bergejala "video tidak dapat
  diputar".
- Aset Bunny pada server tanpa hostname CDN dijawab `409`, bukan diarahkan ke
  jalur berkas yang pasti berujung 404.
- Token expiry tersedia.
- Playback token tidak muncul di log.
- Watermark traceable.
- Concurrent policy dan heartbeat berjalan.
- Revoked session tidak dapat dilanjutkan melalui API.

### Security

- Allowed Domains diverifikasi di staging.
- MediaCage DRM aktif.
- Direct permanent MP4 URL tidak dikembalikan.
- Web bundle tidak mengandung Bunny secret.
- Webhook secret dapat dirotasi.

## 8. Community Feed Test Cases

- Tanpa sesi tidak dapat membaca channel atau feed.
- Pelajar tidak dapat membuat, mengubah, atau mengarsipkan channel.
- Master dengan `discussions.moderate` dapat mengelola channel.
- Pelajar dapat post, komentar, dan bereaksi pada channel biasa.
- Pelajar ditolak menulis channel baca-saja; Master diizinkan.
- Author selalu berasal dari session dan counter komentar/reaksi konsisten.
- Channel membedakan pesan pengguna aktif di kanan dan pengguna lain di kiri
  berdasarkan user ID dari session, bukan nilai yang dikirim browser.
- Channel melakukan refresh berkala hanya saat tab terlihat, mempertahankan
  snapshot lama bila refresh sementara gagal, dan mencegah request overlap.
- Enter mengirim pesan, Shift+Enter membuat baris baru, dan pengiriman ganda
  dicegah selama mutation masih berjalan.
- Sidebar, feed, serta rail event/pengumuman berubah menjadi satu kolom pada
  layar sempit tanpa overflow horizontal.
- Beranda Pelajar tetap menampilkan ringkasan progres dan pintasan ke halaman
  Community yang terpisah.
- Master dapat mengubah nama, slug, keterangan, urutan, dan akses menulis
  channel; Pelajar tetap ditolak oleh endpoint admin.
- Avatar memakai foto profil bila ada dan fallback inisial bila tidak ada;
  input pesan serta balasan terlihat jelas pada tema terang dan gelap.
- Penulis dapat mengubah tulisannya sendiri, dan perubahan itu mengisi
  `editedAt` sehingga jejaknya terlihat pembaca lain.
- Master dapat menghapus tulisan pelajar tetapi ditolak mengubah isinya, dan
  penghapusannya tercatat di audit log beserta isi aslinya.
- Pelajar lain ditolak mengubah maupun menghapus tulisan orang, dan `canEdit`
  serta `canDelete` yang diterimanya bernilai false.
- Menghapus balasan menghitung ulang `commentCount` pada tulisannya.
- Pesan di luar halaman pertama tetap dapat diambil, dan urutan percakapan
  tetap kronologis meskipun pesan lama mendapat balasan baru.
- Pratinjau membawa enam balasan terakhir, dan balasan ketujuh ke belakang
  tetap terjangkau lewat endpoint balasan.
- Penyegaran berkala menggabungkan pesan baru dengan pesan lama yang sudah
  ditarik pengguna, alih-alih membuangnya.
- Pelajar ditolak menyematkan, termasuk tulisannya sendiri, dan menerima
  `canPin: false`; Master diizinkan dan tindakannya tercatat di audit log.
- Tulisan tersemat naik ke atas pada feed, tetapi percakapan channel tetap
  kronologis dan sematannya terbaca dari daftar tersendiri.
