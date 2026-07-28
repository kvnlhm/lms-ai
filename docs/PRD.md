# Product Requirement Document

## Learning Management System Akademi Online

| Informasi | Detail |
|---|---|
| Nama Produk | LMS Akademi Online |
| Versi Dokumen | 1.1 |
| Status | Draft MVP |
| Platform | Responsive Web Application |
| Target Pengguna | Business owner, marketer, calon praktisi coding dan AI, serta pencari kerja berbasis AI |
| Role MVP | Master dan Pelajar |
| Tujuan Utama | Membantu pengguna menguasai coding, AI, penerapan AI untuk bisnis dan marketing, serta kompetensi kerja berbasis AI |

---

## 1. Ringkasan Produk

Learning Management System ini merupakan platform pembelajaran online yang berfokus pada peningkatan kemampuan praktis di bidang coding, artificial intelligence, penerapan AI untuk bisnis dan marketing, serta kesiapan kerja berbasis AI.

Target utama platform adalah:

- Business owner yang ingin menerapkan AI dan automation untuk bisnis.
- Marketer yang ingin meningkatkan kemampuan marketing menggunakan AI.
- Pemula yang ingin belajar coding dari dasar.
- Pengguna yang ingin mempelajari dan menerapkan AI secara praktis.
- Pencari kerja atau profesional yang ingin mendapatkan peluang kerja dengan kompetensi AI.

Pada fase MVP, sistem memiliki dua role:

1. **Master**
2. **Pelajar**

Master mengelola pengguna, kursus, materi, enrollment, forum, pengumuman, serta insight pembelajaran.

Pelajar menggunakan platform untuk mengikuti learning path, mempelajari materi, mengerjakan aktivitas pembelajaran, melihat progres, melanjutkan materi terakhir, dan berdiskusi dengan pelajar lain.

Pembeda utama LMS ini adalah kemampuan Master untuk memahami pola perilaku belajar, kebutuhan kompetensi, kesulitan pengguna, dan kesiapan pengguna dalam menerapkan kemampuan yang dipelajari.

---

## 2. Latar Belakang

Banyak platform pembelajaran hanya menampilkan jumlah pengguna, jumlah enrollment, dan persentase penyelesaian kursus.

Data tersebut belum cukup untuk memahami:

- Materi yang paling diminati.
- Materi yang paling sulit dipahami.
- Titik pengguna berhenti belajar.
- Pengguna yang mulai tidak aktif.
- Waktu belajar paling aktif.
- Materi yang paling sering diulang.
- Pertanyaan yang paling sering muncul.
- Hubungan antara partisipasi forum dan keberhasilan belajar.

LMS ini dirancang agar akademi dapat menggunakan data aktivitas pembelajaran untuk meningkatkan kualitas materi, engagement, dan tingkat penyelesaian kursus.

---


## 2.1 Target Pengguna dan Persona

### A. Business Owner

#### Kebutuhan

- Memahami penggunaan AI untuk operasional, marketing, penjualan, dan customer service.
- Membuat automation yang dapat mengurangi pekerjaan manual.
- Mengidentifikasi use case AI yang relevan dengan bisnis.
- Meningkatkan produktivitas tim.
- Membuat sistem atau prototype sederhana tanpa bergantung penuh kepada developer.

#### Hasil Pembelajaran yang Diharapkan

- Memiliki AI workflow yang dapat diterapkan.
- Mampu memilih tools AI sesuai kebutuhan.
- Mampu membuat automation atau prototype sederhana.
- Memahami risiko, biaya, dan peluang implementasi AI.

### B. Marketer

#### Kebutuhan

- Menggunakan AI untuk riset, strategi, content creation, campaign, dan analytics.
- Meningkatkan kecepatan produksi konten.
- Memahami automation marketing.
- Menggunakan AI untuk membaca data dan insight pelanggan.
- Membangun portfolio AI marketing.

#### Hasil Pembelajaran yang Diharapkan

- Mampu membuat workflow AI marketing.
- Mampu menghasilkan dan mengevaluasi konten dengan AI.
- Mampu membuat campaign berbasis data.
- Mampu menunjukkan portfolio project yang relevan.

### C. Pemula yang Ingin Belajar Coding

#### Kebutuhan

- Mempelajari konsep coding dari dasar.
- Memahami logika pemrograman.
- Menggunakan AI sebagai coding assistant secara benar.
- Membuat project nyata secara bertahap.
- Memahami cara membaca, menguji, dan memperbaiki kode.

#### Hasil Pembelajaran yang Diharapkan

- Mampu membangun project sederhana.
- Memahami alur pengembangan software.
- Mampu menggunakan version control.
- Mampu melakukan debugging dasar.
- Memiliki portfolio project.

### D. Pengguna yang Ingin Belajar AI

#### Kebutuhan

- Memahami dasar AI, generative AI, LLM, prompting, dan automation.
- Mengetahui batasan dan risiko penggunaan AI.
- Menggunakan AI untuk kebutuhan personal maupun profesional.
- Membuat solusi AI sederhana.
- Mengikuti perkembangan tools dan praktik AI.

#### Hasil Pembelajaran yang Diharapkan

- Memahami konsep AI secara praktis.
- Mampu membuat prompt dan workflow yang konsisten.
- Mampu memilih model dan tools yang tepat.
- Mampu membuat project AI sederhana.

### E. Pencari Kerja dan Career Switcher Berbasis AI

#### Kebutuhan

- Mengetahui skill AI yang dibutuhkan industri.
- Memilih learning path sesuai target pekerjaan.
- Membuat portfolio dan capstone project.
- Mempersiapkan CV, interview, dan job application.
- Mengetahui progres kesiapan kerja.

#### Hasil Pembelajaran yang Diharapkan

- Memiliki portfolio yang dapat ditunjukkan.
- Memiliki bukti penyelesaian learning path.
- Memahami job role yang relevan.
- Memiliki skill map dan rekomendasi pengembangan.
- Lebih siap melamar pekerjaan berbasis AI.

### Segmentasi Learning Path

Platform minimal mendukung kategori learning path berikut:

1. **AI for Business Owner**
2. **AI for Marketing**
3. **Coding Fundamentals**
4. **AI Fundamentals and Applied AI**
5. **AI Career and Job Readiness**

Pada MVP, kategori digunakan untuk mengelompokkan kursus dan membaca minat pengguna. Sistem rekomendasi otomatis dapat dikembangkan pada fase selanjutnya.

---

## 3. Tujuan Produk

### 3.1 Tujuan Utama

Meningkatkan efektivitas pembelajaran pengguna melalui pengalaman belajar yang terstruktur, terukur, dan interaktif.

### 3.2 Tujuan Bisnis

- Meningkatkan tingkat penyelesaian kursus.
- Meningkatkan engagement pengguna.
- Mengurangi pengguna yang berhenti belajar.
- Membantu Master memahami kebutuhan pelajar.
- Membantu akademi mengevaluasi performa materi.
- Meningkatkan retensi pengguna.
- Menjadikan LMS sebagai pusat aktivitas akademi.

### 3.3 Tujuan Pelajar

Pelajar dapat:

- Memilih atau mengikuti learning path sesuai tujuan.
- Mengetahui kursus dan kompetensi yang sedang dipelajari.
- Melanjutkan materi terakhir.
- Melihat progres pembelajaran dan penyelesaian learning path.
- Mengetahui materi yang sudah atau belum selesai.
- Menyimpan hasil project atau portfolio pembelajaran pada fase pengembangan.
- Bertanya melalui forum diskusi.
- Berdiskusi dengan pelajar lain.
- Melihat histori aktivitas belajar.
- Memahami area kompetensi yang masih perlu ditingkatkan.

### 3.4 Tujuan Master

Master dapat:

- Mengelola akun pelajar.
- Mengelola kursus, modul, dan materi.
- Mengatur enrollment pelajar.
- Memantau progres pembelajaran.
- Memahami perilaku belajar pengguna.
- Mengetahui materi dengan drop-off tinggi.
- Menemukan pelajar yang membutuhkan bantuan.
- Mengelola dan memoderasi forum.
- Melihat laporan aktivitas pembelajaran.

---

## 4. Ruang Lingkup MVP

### 4.1 Termasuk dalam MVP

#### Modul Master

- Authentication.
- Dashboard Master.
- User management.
- Course management.
- Module management.
- Lesson management.
- Enrollment management.
- Progress monitoring.
- Learning behaviour analytics.
- Forum moderation.
- Announcement management.
- In-app notification.
- Basic reporting.
- Audit log.

#### Modul Pelajar

- Authentication.
- Dashboard Pelajar.
- Daftar kursus.
- Detail kursus.
- Halaman pembelajaran.
- Materi video.
- Materi teks.
- Materi PDF.
- Tautan eksternal.
- Progress tracking.
- Continue learning.
- Learning history.
- Forum diskusi.
- Pengumuman.
- Notifikasi.
- Profil pengguna.

### 4.2 Tidak Termasuk dalam MVP

- Payment gateway.
- Marketplace kursus.
- Subscription management.
- Role mentor atau instruktur.
- Live class.
- Integrasi Zoom atau Google Meet.
- Sertifikat otomatis.
- Quiz dan ujian.
- Assignment dan penilaian manual.
- Gamification.
- Poin dan leaderboard.
- AI tutor.
- AI course recommendation.
- Aplikasi mobile native.
- Affiliate system.
- Multi-academy atau multi-tenant.
- Integrasi WhatsApp.
- Push notification.

---

## 5. User Roles

## 5.1 Master

Master adalah pengguna dengan akses tertinggi pada sistem.

### Hak Akses Master

- Login dan logout.
- Melihat dashboard.
- Mengelola akun pelajar.
- Membuat, mengubah, menonaktifkan, dan menghapus pengguna.
- Membuat dan mengelola kursus.
- Membuat struktur modul dan materi.
- Mengatur urutan pembelajaran.
- Mengatur status publikasi kursus.
- Mendaftarkan pelajar ke kursus.
- Mengeluarkan pelajar dari kursus.
- Melihat progres seluruh pelajar.
- Melihat insight perilaku belajar.
- Melihat performa setiap kursus.
- Melihat pengguna berisiko berhenti.
- Mengelola forum diskusi.
- Menghapus atau menyembunyikan konten forum.
- Mengunci diskusi.
- Membuat pengumuman.
- Melihat laporan.
- Mengekspor laporan.
- Melihat audit log.

## 5.2 Pelajar

Pelajar adalah pengguna yang mengikuti proses pembelajaran.

### Hak Akses Pelajar

- Login dan logout.
- Mengubah profil.
- Mengubah password.
- Melihat kursus yang dimiliki.
- Membuka materi pembelajaran.
- Menandai materi selesai.
- Melihat progres.
- Melanjutkan materi terakhir.
- Melihat histori belajar.
- Membuat topik diskusi.
- Membalas diskusi.
- Mengubah postingan milik sendiri.
- Menghapus postingan milik sendiri.
- Memberikan reaksi.
- Melaporkan konten.
- Melihat pengumuman.
- Melihat notifikasi.

---

## 6. User Flow Utama

## 6.1 User Flow Pelajar

1. Pelajar menerima atau membuat akun.
2. Pelajar login ke platform.
3. Sistem mengarahkan Pelajar ke dashboard.
4. Pelajar melihat kursus yang diikuti.
5. Pelajar memilih kursus.
6. Pelajar melihat struktur modul dan materi.
7. Pelajar membuka materi.
8. Sistem mencatat aktivitas pembelajaran.
9. Pelajar menyelesaikan materi.
10. Sistem memperbarui progres.
11. Pelajar melanjutkan ke materi berikutnya.
12. Pelajar dapat membuka forum diskusi.
13. Pelajar dapat melihat histori dan progres.

## 6.2 User Flow Master

1. Master login ke platform.
2. Master membuka dashboard.
3. Master membuat kursus.
4. Master membuat modul.
5. Master menambahkan materi.
6. Master mempublikasikan kursus.
7. Master mendaftarkan pelajar.
8. Pelajar mulai mengikuti kursus.
9. Sistem merekam aktivitas belajar.
10. Master memantau progres dan perilaku pengguna.
11. Master mengidentifikasi masalah pembelajaran.
12. Master mengambil tindakan berdasarkan insight.

Contoh tindakan:

- Memperbaiki materi yang memiliki drop-off tinggi.
- Menambahkan materi penjelasan.
- Mengirim pengumuman.
- Menghubungi pengguna tidak aktif.
- Menjawab pertanyaan yang sering muncul.
- Mengubah urutan materi.

---

## 7. Functional Requirements

## 7.1 Authentication

### Fitur

- Login dengan email dan password.
- Logout.
- Lupa password.
- Reset password.
- Remember me.
- Validasi akun aktif atau nonaktif.
- Pembatasan akses berdasarkan role.
- Session management.

### Acceptance Criteria

- Pengguna hanya dapat login dengan kredensial yang valid.
- Akun nonaktif tidak dapat login.
- Master diarahkan ke dashboard Master.
- Pelajar diarahkan ke dashboard Pelajar.
- Pelajar tidak dapat membuka halaman Master.
- Password disimpan menggunakan secure hashing.
- Session yang kedaluwarsa harus meminta pengguna login kembali.

---

## 7.2 Dashboard Master

### Informasi Utama

- Total pelajar.
- Pelajar aktif.
- Pelajar tidak aktif.
- Total kursus.
- Total enrollment.
- Rata-rata progres.
- Course completion rate.
- Rata-rata durasi belajar.
- Jumlah diskusi aktif.
- Jumlah pengguna berisiko.
- Kursus dengan performa tertinggi.
- Kursus dengan performa terendah.
- Aktivitas pembelajaran terbaru.
- Materi dengan drop-off tertinggi.

### Filter

- Hari ini.
- Tujuh hari terakhir.
- Tiga puluh hari terakhir.
- Rentang tanggal khusus.
- Kursus.
- Status pengguna.
- Risk level.

### Acceptance Criteria

- Master dapat melihat ringkasan data pembelajaran.
- Master dapat memfilter data.
- Setiap insight dapat dibuka ke halaman detail.
- Data dashboard mengikuti aktivitas terbaru.
- Data yang ditampilkan harus konsisten dengan laporan.

---

## 7.3 User Management

### Data Pengguna

- Nama lengkap.
- Email.
- Nomor telepon opsional.
- Foto profil.
- Role.
- Status akun.
- Tanggal bergabung.
- Login terakhir.
- Aktivitas terakhir.
- Kursus yang diikuti.
- Progres keseluruhan.
- Total waktu belajar.

### Status Pengguna

- Active.
- Inactive.
- Suspended.

### Fitur Master

- Menambah pengguna.
- Mengubah pengguna.
- Mengaktifkan akun.
- Menonaktifkan akun.
- Menangguhkan akun.
- Menghapus akun.
- Melihat detail pengguna.
- Mencari pengguna.
- Memfilter pengguna.
- Mengekspor data pengguna.

### Acceptance Criteria

- Email harus unik.
- Master dapat melihat kursus yang diikuti pengguna.
- Menonaktifkan akun tidak menghapus histori belajar.
- Penghapusan permanen membutuhkan konfirmasi.
- Tindakan administratif tercatat dalam audit log.
- Pelajar tidak dapat mengubah role sendiri.

---

## 7.4 Course Management

### Data Kursus

- Nama kursus.
- Slug.
- Deskripsi singkat.
- Deskripsi lengkap.
- Thumbnail.
- Level.
- Estimasi durasi.
- Status kursus.
- Tanggal dibuat.
- Tanggal dipublikasikan.
- Jumlah modul.
- Jumlah materi.

### Status Kursus

- Draft.
- Published.
- Archived.

### Fitur

- Membuat kursus.
- Mengubah kursus.
- Menghapus kursus.
- Mengarsipkan kursus.
- Mempublikasikan kursus.
- Mengatur thumbnail.
- Mengatur urutan modul.
- Melihat daftar pelajar.
- Melihat performa kursus.

### Acceptance Criteria

- Kursus draft hanya dapat dilihat Master.
- Kursus published hanya dapat dibuka pelajar yang terdaftar.
- Kursus tidak dapat dipublikasikan tanpa materi.
- Kursus archived tidak menerima enrollment baru.
- Penghapusan kursus membutuhkan konfirmasi.
- Histori belajar tidak boleh hilang tanpa peringatan.

---

## 7.5 Module Management

### Data Modul

- Nama modul.
- Deskripsi.
- Nomor urutan.
- Status.
- Estimasi durasi.
- Jumlah materi.

### Fitur

- Membuat modul.
- Mengubah modul.
- Menghapus modul.
- Mengaktifkan modul.
- Menonaktifkan modul.
- Mengubah urutan modul.

### Acceptance Criteria

- Modul harus terhubung ke satu kursus.
- Urutan modul harus tersimpan.
- Modul nonaktif tidak dapat dibuka pelajar.
- Penghapusan modul dengan materi membutuhkan konfirmasi.

---

## 7.6 Lesson Management

### Jenis Materi MVP

- Video.
- Teks atau artikel.
- PDF atau dokumen.
- Tautan eksternal.

### Data Materi

- Judul.
- Deskripsi.
- Jenis materi.
- Konten atau URL.
- Durasi.
- Nomor urutan.
- Status.
- Wajib atau opsional.
- Preview tersedia atau tidak.

### Fitur

- Menambah materi.
- Mengubah materi.
- Menghapus materi.
- Mengatur urutan.
- Mengatur status.
- Mengunggah file.
- Menambahkan video.
- Menentukan syarat penyelesaian.

### Acceptance Criteria

- Materi harus terhubung ke satu modul.
- Pelajar hanya dapat membuka materi dari kursus yang dimiliki.
- Sistem mencatat saat materi dibuka.
- Sistem mencatat saat materi diselesaikan.
- Materi yang dihapus tidak boleh merusak histori progres.
- File harus melalui validasi jenis dan ukuran.

---

## 7.7 Enrollment Management

### Status Enrollment

- Not Started.
- In Progress.
- Completed.
- Access Expired.
- Removed.

### Fitur Master

- Mendaftarkan pelajar ke kursus.
- Mengeluarkan pelajar dari kursus.
- Mengaktifkan kembali enrollment.
- Melihat tanggal enrollment.
- Melihat status pembelajaran.
- Mengatur masa akses.

### Acceptance Criteria

- Pelajar hanya dapat membuka kursus yang terdaftar.
- Enrollment duplikat tidak diperbolehkan.
- Menghapus akses tidak menghapus histori progres.
- Master dapat mengaktifkan kembali akses.
- Masa akses yang berakhir harus memblokir materi.

---

## 7.8 Dashboard Pelajar

### Informasi Utama

- Sapaan pengguna.
- Kursus yang sedang dipelajari.
- Tombol lanjutkan belajar.
- Materi terakhir yang dibuka.
- Progres setiap kursus.
- Jumlah kursus selesai.
- Kursus yang belum dimulai.
- Aktivitas belajar terakhir.
- Diskusi terbaru.
- Pengumuman terbaru.

### Acceptance Criteria

- Pelajar dapat melanjutkan materi terakhir maksimal dalam dua klik.
- Progres setiap kursus terlihat jelas.
- Kursus selesai dan belum selesai dapat dibedakan.
- Dashboard hanya menampilkan data pengguna tersebut.
- Tampilan nyaman digunakan melalui mobile browser.

---

## 7.9 Course Learning Page

### Struktur Halaman

- Nama kursus.
- Daftar modul.
- Daftar materi.
- Status materi.
- Area konten.
- Tombol materi sebelumnya.
- Tombol materi berikutnya.
- Tombol tandai selesai.
- Indikator progres.
- Tombol menuju forum.

### Status Materi

- Locked.
- Not Started.
- In Progress.
- Completed.

### Acceptance Criteria

- Sistem menyimpan materi terakhir yang dibuka.
- Pengguna dapat kembali ke materi terakhir.
- Progres diperbarui saat materi selesai.
- Navigasi previous dan next berfungsi.
- Materi selesai memiliki indikator visual.
- Progres tetap tersimpan setelah logout.
- Materi locked tidak dapat dibuka tanpa memenuhi syarat.

---

## 7.10 Progress Tracking

### Data yang Dicatat

- Materi yang dibuka.
- Materi yang selesai.
- Waktu pertama dibuka.
- Waktu terakhir dibuka.
- Durasi belajar.
- Persentase progres.
- Modul yang selesai.
- Tanggal penyelesaian kursus.
- Frekuensi aktivitas.

### Rumus Progres

```text
Jumlah materi wajib selesai / total materi wajib x 100%
```

Materi opsional tidak memengaruhi progres utama.

### Acceptance Criteria

- Progres bernilai 0 sampai 100 persen.
- Progres tidak boleh lebih dari 100 persen.
- Kursus dianggap selesai saat semua materi wajib selesai.
- Master dan Pelajar dapat melihat progres.
- Sistem menyimpan histori perubahan progres.
- Update progres dilakukan secara konsisten dan aman dari duplikasi.

---

## 7.11 Learning History

### Informasi Histori

- Kursus.
- Modul.
- Materi.
- Jenis aktivitas.
- Waktu aktivitas.
- Durasi belajar.
- Progres sebelum aktivitas.
- Progres setelah aktivitas.

### Acceptance Criteria

- Pelajar hanya dapat melihat histori miliknya.
- Master dapat melihat histori seluruh pelajar.
- Histori dapat difilter berdasarkan periode.
- Histori tidak dapat diubah oleh Pelajar.
- Data histori tetap tersimpan saat enrollment dinonaktifkan.

---

## 7.12 Discussion Forum

### Struktur Forum

Forum dapat dikaitkan dengan:

- Kursus.
- Modul.
- Materi.

### Fitur Pelajar

- Membuat topik.
- Menulis pertanyaan.
- Membalas diskusi.
- Mengubah postingan milik sendiri.
- Menghapus postingan milik sendiri.
- Memberikan reaksi.
- Melaporkan konten.
- Mencari diskusi.

### Fitur Master

- Melihat seluruh diskusi.
- Membalas diskusi.
- Menyematkan diskusi.
- Mengunci diskusi.
- Menyembunyikan konten.
- Menghapus konten.
- Melihat laporan konten.
- Menandai jawaban terbaik.

### Status Diskusi

- Open.
- Resolved.
- Locked.
- Hidden.

### Acceptance Criteria

- Pelajar hanya dapat mengakses forum kursus yang dimiliki.
- Pelajar tidak dapat mengubah postingan pengguna lain.
- Master dapat melakukan moderasi.
- Konten yang dilaporkan masuk daftar review.
- Semua postingan memiliki timestamp.
- Konten hidden tidak terlihat oleh Pelajar.

---

## 7.13 Announcement Management

### Target Pengumuman

- Seluruh pengguna.
- Pelajar dari kursus tertentu.
- Pengguna tertentu.

### Data Pengumuman

- Judul.
- Isi.
- Target audiens.
- Tanggal publikasi.
- Tanggal berakhir.
- Status.
- Dibuat oleh.

### Acceptance Criteria

- Pelajar hanya menerima pengumuman yang relevan.
- Master dapat menjadwalkan pengumuman.
- Pengumuman yang berakhir tidak tampil sebagai aktif.
- Sistem mencatat status sudah dibaca atau belum.
- Pengumuman draft tidak terlihat oleh Pelajar.

---

## 7.14 Notification

### Trigger untuk Pelajar

- Ditambahkan ke kursus.
- Materi baru tersedia.
- Kursus diperbarui.
- Pengumuman baru.
- Diskusi mendapat balasan.
- Jawaban ditandai sebagai jawaban terbaik.
- Kursus selesai.

### Trigger untuk Master

- Diskusi baru.
- Konten dilaporkan.
- Pelajar masuk kategori high risk.
- Kursus memiliki drop-off tinggi.
- Pertanyaan belum dijawab.

### Channel MVP

- In-app notification.

### Acceptance Criteria

- Pengguna hanya menerima notifikasi yang relevan.
- Pengguna dapat menandai notifikasi sebagai dibaca.
- Notifikasi memiliki tautan ke objek terkait.
- Pelajar tidak menerima data sensitif pengguna lain.

---

## 7.15 User Profile

### Data Profil

- Nama lengkap.
- Foto profil.
- Email.
- Nomor telepon.
- Bio singkat.
- Preferensi notifikasi.

### Fitur

- Mengubah profil.
- Mengubah foto.
- Mengubah password.
- Mengatur preferensi notifikasi.

### Acceptance Criteria

- Email harus unik.
- Password lama diperlukan untuk mengganti password.
- Foto harus melalui validasi file.
- Pengguna tidak dapat mengubah role.
- Perubahan profil tercatat dengan timestamp.

---

## 8. Learning Behaviour Analytics

Learning Behaviour Analytics adalah fitur utama yang membantu Master memahami cara pengguna belajar.

## 8.1 Aktivitas yang Direkam

- Login.
- Logout.
- Membuka dashboard.
- Membuka kursus.
- Membuka modul.
- Membuka materi.
- Menyelesaikan materi.
- Mengulang materi.
- Melanjutkan materi.
- Membuat diskusi.
- Membalas diskusi.
- Memberikan reaksi.
- Mengunduh materi.
- Membuka pengumuman.
- Waktu aktivitas.
- Durasi sesi.
- Device type.
- Browser.
- Sumber akses jika tersedia.

## 8.2 Insight Aktivitas Belajar

Master dapat melihat:

- Daily Active Learners.
- Weekly Active Learners.
- Monthly Active Learners.
- Rata-rata frekuensi belajar.
- Rata-rata durasi belajar.
- Hari belajar paling aktif.
- Jam belajar paling aktif.
- Jumlah pengguna yang kembali belajar.

## 8.3 Course Engagement

Master dapat melihat:

- Jumlah pelajar per kursus.
- Course start rate.
- Course completion rate.
- Rata-rata progres.
- Rata-rata waktu penyelesaian.
- Jumlah materi yang dikunjungi ulang.
- Forum participation rate.
- Jumlah pengguna aktif pada kursus.

## 8.4 Drop-off Analysis

Master dapat melihat:

- Materi dengan drop-off tertinggi.
- Modul dengan progres terendah.
- Titik terakhir sebelum pengguna berhenti.
- Jumlah pengguna tidak aktif setelah materi tertentu.
- Pelajar yang tidak melanjutkan pembelajaran.
- Durasi berhenti pada materi tertentu.

## 8.5 Content Performance

Master dapat melihat:

- Materi paling banyak dibuka.
- Materi paling sedikit dibuka.
- Materi paling sering diulang.
- Materi dengan durasi belajar tertinggi.
- Materi dengan jumlah diskusi tertinggi.
- Materi dengan tingkat penyelesaian rendah.
- Materi yang kemungkinan terlalu sulit.

## 8.6 Student Risk Indicator

### Low Risk

- Aktif dalam tujuh hari terakhir.
- Memiliki kenaikan progres rutin.
- Tidak berhenti lebih dari tujuh hari.

### Medium Risk

Salah satu kondisi berikut terjadi:

- Tidak aktif selama tujuh sampai tiga belas hari.
- Tidak ada kenaikan progres selama tujuh hari.
- Progres lebih rendah dari rata-rata kursus.
- Mengulang materi berkali-kali tanpa menyelesaikan.

### High Risk

Salah satu kondisi berikut terjadi:

- Tidak aktif selama empat belas hari atau lebih.
- Tidak pernah memulai kursus setelah empat belas hari enrollment.
- Berhenti pada materi yang sama lebih dari empat belas hari.
- Progres tidak berubah selama empat belas hari.
- Beberapa kali login tanpa membuka materi.

### Acceptance Criteria

- Master dapat melihat risk level setiap pelajar.
- Sistem menampilkan alasan risk level.
- Risk scoring dihitung menggunakan rule-based logic pada MVP.
- Perubahan risk level tercatat.
- Risk level dapat difilter.

## 8.7 Learning Needs Insight

Kebutuhan pelajar dapat diketahui melalui:

- Pertanyaan yang sering muncul.
- Materi yang sering diulang.
- Materi dengan durasi belajar tinggi.
- Kata kunci yang sering muncul di forum.
- Materi dengan drop-off tinggi.
- Kursus yang paling diminati.
- Feedback pengguna.
- Pencarian yang tidak menghasilkan materi.


## 8.8 Segment and Learning Goal Insight

Master dapat menganalisis perilaku berdasarkan tujuan belajar pengguna:

- Business owner.
- Marketer.
- Coding learner.
- AI learner.
- Job seeker atau career switcher.

Insight yang dapat ditampilkan:

- Learning path paling diminati.
- Completion rate per segmen.
- Materi dengan drop-off tertinggi per segmen.
- Skill atau topik yang paling banyak dicari.
- Forum topic yang paling sering dibahas.
- Pengguna yang belum menentukan tujuan belajar.
- Perbandingan engagement antarsegmen.
- Materi yang relevan untuk kebutuhan pekerjaan.
- Pengguna yang mendekati penyelesaian learning path.

### Data Profil Pembelajaran

Saat onboarding atau pengaturan profil, sistem dapat menyimpan:

- Tujuan belajar utama.
- Tingkat pengalaman.
- Bidang pekerjaan.
- Target skill.
- Target learning path.
- Estimasi waktu belajar per minggu.
- Target penyelesaian opsional.

### Acceptance Criteria

- Pelajar dapat memilih satu tujuan belajar utama.
- Master dapat memfilter analytics berdasarkan tujuan belajar.
- Perubahan tujuan belajar tidak menghapus histori.
- Data tujuan belajar tidak ditampilkan kepada pelajar lain.
- Insight segmentasi dapat ditelusuri ke data pengguna dan aktivitas.

---

## 9. Reporting

### Laporan MVP

- Laporan pengguna.
- Laporan enrollment.
- Laporan progres.
- Laporan penyelesaian kursus.
- Laporan aktivitas belajar.
- Laporan pengguna tidak aktif.
- Laporan pengguna berisiko.
- Laporan forum.
- Laporan performa kursus.

### Format Ekspor

- CSV untuk MVP.
- Excel pada fase berikutnya.
- PDF pada fase berikutnya.

### Acceptance Criteria

- Laporan mengikuti filter yang aktif.
- Data ekspor sesuai dengan dashboard.
- Hanya Master yang dapat mengekspor.
- Informasi sensitif harus dibatasi.
- Aktivitas ekspor tercatat pada audit log.

---

## 10. Search and Filtering

### Area Pencarian

- Pengguna.
- Kursus.
- Materi.
- Forum.
- Pengumuman.

### Filter Pengguna

- Status akun.
- Kursus.
- Progres.
- Aktivitas terakhir.
- Risk level.

### Filter Kursus

- Draft.
- Published.
- Archived.
- Level.
- Tanggal dibuat.

### Acceptance Criteria

- Pencarian tidak case-sensitive.
- Hasil relevan dengan keyword.
- Beberapa filter dapat digunakan bersama.
- Filter dapat direset.
- Daftar dengan data besar menggunakan pagination.

---

## 11. Business Rules

1. Setiap pengguna hanya memiliki satu role pada MVP.
2. Email harus unik.
3. Pelajar hanya dapat membuka kursus yang terdaftar.
4. Kursus draft hanya dapat dilihat Master.
5. Kursus archived tidak menerima enrollment baru.
6. Materi wajib memengaruhi progres.
7. Materi opsional tidak memengaruhi progres utama.
8. Progres maksimal adalah 100 persen.
9. Kursus selesai ketika seluruh materi wajib selesai.
10. Pelajar hanya dapat mengubah postingan miliknya.
11. Master dapat memoderasi seluruh forum.
12. Histori aktivitas tidak dapat diubah Pelajar.
13. Menonaktifkan akun tidak menghapus histori belajar.
14. Penghapusan data penting membutuhkan konfirmasi.
15. Tindakan administratif penting harus masuk audit log.
16. Insight perilaku hanya dapat diakses Master.
17. Data pribadi tidak boleh ditampilkan kepada pelajar lain, kecuali nama dan foto pada forum.
18. Pelajar yang dikeluarkan dari kursus kehilangan akses, tetapi histori progres tetap tersimpan.
19. Semua aktivitas memiliki timestamp.
20. Semua perhitungan insight harus dapat ditelusuri ke data aktivitas.
21. Authorisation harus divalidasi pada backend.
22. Progress tidak boleh hanya dihitung pada frontend.
23. File upload harus melalui validasi jenis dan ukuran.
24. Enrollment pengguna ke kursus yang sama tidak boleh duplikat.

---

## 12. Non-Functional Requirements

## 12.1 Performance

- Halaman utama dimuat maksimal tiga detik pada koneksi normal.
- Dashboard Master dimuat maksimal lima detik.
- Daftar besar menggunakan pagination.
- Query analytics harus menggunakan index yang sesuai.
- File besar tidak boleh memblokir request utama.
- Video disarankan menggunakan video hosting atau object storage.

## 12.2 Security

- Password menggunakan secure hashing.
- Role-based access control.
- Server-side authorisation.
- Proteksi SQL injection.
- Proteksi cross-site scripting.
- Proteksi CSRF.
- Rate limiting pada login.
- Session expiration.
- Audit log.
- Validasi file upload.
- Pembatasan ukuran file.
- Validasi input.
- Backup berkala.
- Environment secret tidak disimpan di repository.

## 12.3 Privacy

- Data perilaku hanya digunakan untuk meningkatkan pembelajaran.
- Pengguna diinformasikan mengenai aktivitas yang direkam.
- Data pribadi tidak dapat diakses pengguna lain.
- Master hanya dapat melihat data dalam akademi yang dikelola.
- Penghapusan akun mengikuti kebijakan retensi data.
- Ekspor data sensitif dibatasi.

## 12.4 Scalability

Arsitektur harus memungkinkan:

- Penambahan role instruktur.
- Penambahan ribuan pengguna.
- Penambahan banyak kursus.
- Integrasi payment gateway.
- Integrasi AI analytics.
- Integrasi mobile application.
- Multi-academy pada fase lanjutan.

## 12.5 Responsive Design

Sistem harus dapat digunakan melalui:

- Desktop.
- Tablet.
- Mobile browser.

Dashboard Master diprioritaskan untuk desktop.

Dashboard dan learning page Pelajar harus nyaman digunakan melalui mobile browser.

## 12.6 Accessibility

- Teks mudah dibaca.
- Kontras warna memadai.
- Form memiliki label.
- Mendukung navigasi keyboard dasar.
- Gambar penting memiliki alt text.
- Video mendukung subtitle apabila tersedia.
- Status tidak hanya dibedakan melalui warna.

## 12.7 Reliability

- Sistem memiliki error logging.
- Sistem memiliki health check.
- Backup database dilakukan berkala.
- Tersedia prosedur restore.
- Migration memiliki rollback.
- Aktivitas progress menggunakan transaksi saat diperlukan.

---

## 13. Audit Log

### Aktivitas yang Dicatat

- Membuat pengguna.
- Mengubah pengguna.
- Menonaktifkan pengguna.
- Menghapus pengguna.
- Membuat kursus.
- Mengubah kursus.
- Mempublikasikan kursus.
- Mengarsipkan kursus.
- Menghapus kursus.
- Mengubah enrollment.
- Memoderasi forum.
- Mengekspor laporan.
- Mengubah pengaturan sistem.

### Data Audit Log

- Actor user ID.
- Jenis tindakan.
- Target entity.
- Target entity ID.
- Data sebelum perubahan.
- Data setelah perubahan.
- Timestamp.
- IP address apabila diperlukan.
- User agent apabila diperlukan.

---

## 14. High-Level Data Entities

### User

Menyimpan data Master dan Pelajar.

### Role

Menyimpan jenis role pengguna.

### Course

Menyimpan data kursus.

### Module

Menyimpan modul pada kursus.

### Lesson

Menyimpan materi pembelajaran.

### Enrollment

Menghubungkan Pelajar dengan Course.

### LessonProgress

Menyimpan progres pengguna per materi.

### CourseProgress

Menyimpan progres keseluruhan kursus.

### LearningSession

Menyimpan sesi pembelajaran.

### ActivityLog

Menyimpan aktivitas pengguna.

### Discussion

Menyimpan topik forum.

### DiscussionReply

Menyimpan balasan forum.

### DiscussionReaction

Menyimpan reaksi forum.

### DiscussionReport

Menyimpan laporan konten.

### Announcement

Menyimpan pengumuman.

### Notification

Menyimpan notifikasi.

### UserBookmark

Menyimpan materi yang ditandai.

### AuditLog

Menyimpan aktivitas administratif.

---

## 15. High-Level Relationships

- Satu Role memiliki banyak User.
- Satu User memiliki banyak Enrollment.
- Satu Course memiliki banyak Enrollment.
- Satu Course memiliki banyak Module.
- Satu Module memiliki banyak Lesson.
- Satu User memiliki banyak LessonProgress.
- Satu Lesson memiliki banyak LessonProgress.
- Satu User memiliki banyak CourseProgress.
- Satu Course memiliki banyak CourseProgress.
- Satu User memiliki banyak LearningSession.
- Satu User memiliki banyak ActivityLog.
- Satu Course memiliki banyak Discussion.
- Satu Discussion memiliki banyak DiscussionReply.
- Satu User memiliki banyak Discussion.
- Satu User memiliki banyak DiscussionReply.
- Satu Discussion memiliki banyak DiscussionReaction.
- Satu Discussion dapat memiliki banyak DiscussionReport.
- Satu User memiliki banyak Notification.
- Satu User memiliki banyak UserBookmark.
- Satu User dapat memiliki banyak AuditLog sebagai actor.

---

## 16. Struktur Halaman

## 16.1 Halaman Master

1. Login.
2. Dashboard.
3. User List.
4. User Detail.
5. Add User.
6. Edit User.
7. Course List.
8. Course Detail.
9. Course Builder.
10. Module Management.
11. Lesson Editor.
12. Enrollment Management.
13. Progress Monitoring.
14. Learning Analytics.
15. User Behaviour Detail.
16. Course Analytics Detail.
17. Discussion Management.
18. Announcement Management.
19. Notification Centre.
20. Reports.
21. Audit Logs.
22. Master Profile.
23. System Settings.

## 16.2 Halaman Pelajar

1. Login.
2. Forgot Password.
3. Reset Password.
4. Dashboard.
5. My Courses.
6. Course Detail.
7. Learning Page.
8. Learning History.
9. Discussion Forum.
10. Discussion Detail.
11. Create Discussion.
12. Notifications.
13. Announcements.
14. Profile.
15. Change Password.

---

## 17. Success Metrics

### Product Metrics

- Daily Active Learners.
- Weekly Active Learners.
- Monthly Active Learners.
- Average session duration.
- Average learning frequency.
- Course start rate.
- Course completion rate.
- Average course progress.
- Average time to completion.
- Seven-day learner retention.
- Thirty-day learner retention.
- Forum participation rate.
- Percentage of inactive learners.
- Percentage of at-risk learners.

### Target Awal MVP

Target awal perlu divalidasi setelah satu sampai tiga bulan penggunaan.

- Minimal 60 persen pengguna yang terdaftar mulai membuka kursus.
- Minimal 40 persen pengguna menyelesaikan kursus.
- Minimal 50 persen pengguna aktif setiap minggu.
- Minimal 25 persen pengguna berpartisipasi dalam forum.
- Penurunan pengguna tidak aktif sebesar 15 persen.
- Minimal 80 persen aktivitas utama tercatat tanpa error.

---

## 18. Analytics Event Tracking

### Event Utama

```text
user_logged_in
user_logged_out
dashboard_viewed
course_viewed
course_started
module_opened
lesson_opened
lesson_completed
lesson_replayed
course_completed
discussion_created
discussion_replied
discussion_reacted
discussion_reported
announcement_viewed
material_downloaded
user_became_inactive
user_risk_level_changed
```

### Properti Event

- User ID.
- Role.
- Course ID.
- Module ID.
- Lesson ID.
- Timestamp.
- Session ID.
- Device type.
- Browser.
- Duration.
- Previous page.
- Completion status.
- Metadata tambahan yang relevan.

---

## 19. Definition of Active and Inactive User

### Active User

Pengguna dianggap aktif apabila melakukan minimal satu aktivitas pembelajaran dalam tujuh hari terakhir.

Aktivitas pembelajaran:

- Membuka kursus.
- Membuka materi.
- Menyelesaikan materi.
- Membuat diskusi.
- Membalas diskusi.

### Inactive User

Pengguna dianggap tidak aktif apabila:

- Tidak memiliki aktivitas pembelajaran selama lebih dari tujuh hari; atau
- Belum memulai kursus setelah tujuh hari sejak enrollment.

Batas waktu dapat dibuat configurable pada fase berikutnya.

---

## 20. Key User Stories

### Master

- Sebagai Master, saya ingin melihat seluruh pelajar agar dapat mengelola akses platform.
- Sebagai Master, saya ingin membuat kursus, modul, dan materi agar proses pembelajaran terstruktur.
- Sebagai Master, saya ingin melihat progres pelajar agar mengetahui tingkat penyelesaian pembelajaran.
- Sebagai Master, saya ingin melihat materi dengan drop-off tinggi agar dapat memperbaiki kualitas materi.
- Sebagai Master, saya ingin melihat pengguna tidak aktif agar dapat melakukan follow-up.
- Sebagai Master, saya ingin mengetahui materi yang sering diulang agar dapat mengidentifikasi bagian yang sulit.
- Sebagai Master, saya ingin melihat jam belajar paling aktif agar dapat menentukan waktu komunikasi terbaik.
- Sebagai Master, saya ingin memoderasi forum agar diskusi tetap aman dan relevan.
- Sebagai Master, saya ingin melihat pertanyaan yang sering muncul agar dapat memahami kebutuhan pengguna.

### Pelajar

- Sebagai Pelajar, saya ingin melihat kursus yang saya ikuti agar mengetahui apa yang perlu dipelajari.
- Sebagai Pelajar, saya ingin melanjutkan materi terakhir agar tidak perlu mencarinya kembali.
- Sebagai Pelajar, saya ingin melihat progres agar mengetahui perkembangan pembelajaran.
- Sebagai Pelajar, saya ingin menandai materi selesai agar progres tercatat.
- Sebagai Pelajar, saya ingin bertanya di forum agar mendapatkan bantuan.
- Sebagai Pelajar, saya ingin berdiskusi dengan pengguna lain agar proses belajar lebih interaktif.
- Sebagai Pelajar, saya ingin melihat histori agar mengetahui aktivitas pembelajaran sebelumnya.

---

## 21. Feature Priority

## P0 — Core MVP

- Authentication.
- Role and permission.
- User management.
- Course management.
- Module management.
- Lesson management.
- Enrollment.
- Learning page.
- Progress tracking.
- Student dashboard.
- Master dashboard.
- Basic activity tracking.
- Discussion forum.
- Basic learning analytics.

## P1 — Setelah Core MVP

- Risk scoring.
- Announcement.
- Notification.
- Export report.
- Bookmark materi.
- Advanced forum moderation.
- Course performance analytics.
- User learning timeline.
- Audit log viewer.

## P2 — Pengembangan Lanjutan

- Quiz.
- Assignment.
- Certificate.
- Email notification.
- Gamification.
- AI recommendation.
- AI learning assistant.
- Live class.
- Payment gateway.
- Mobile application.
- Multi-academy.

---

## 22. MVP Acceptance Criteria

MVP dianggap siap digunakan apabila:

1. Master dapat login dan mengelola Pelajar.
2. Master dapat membuat kursus, modul, dan materi.
3. Master dapat mendaftarkan Pelajar ke kursus.
4. Pelajar dapat login dan melihat kursus yang dimiliki.
5. Pelajar dapat membuka dan menyelesaikan materi.
6. Progres tersimpan dengan benar.
7. Pelajar dapat melanjutkan materi terakhir.
8. Pelajar dapat membuat dan membalas diskusi.
9. Master dapat memoderasi forum.
10. Master dapat melihat progres setiap Pelajar.
11. Master dapat melihat performa setiap kursus.
12. Master dapat melihat pengguna aktif dan tidak aktif.
13. Master dapat melihat materi dengan drop-off tinggi.
14. Master dapat melihat pengguna berdasarkan risk level.
15. Pelajar tidak dapat mengakses fitur Master.
16. Data pengguna tidak saling tertukar.
17. Sistem dapat digunakan melalui desktop dan mobile browser.
18. Aktivitas utama tercatat dalam ActivityLog.
19. Sistem memiliki keamanan dan validasi dasar.
20. Tidak terdapat error kritis pada alur utama.
21. Automated test untuk business rule utama berhasil.
22. Tidak ada temuan keamanan critical yang belum diselesaikan.

---

## 23. Tahapan Pengembangan

## Phase 1 — Foundation

- Repository setup.
- Environment setup.
- Authentication.
- Role and permission.
- User management.
- Database foundation.
- Master layout.
- Pelajar layout.
- Basic security.

## Phase 2 — Learning Management

- Course.
- Module.
- Lesson.
- Enrollment.
- File management.
- Course publishing.

## Phase 3 — Learning Experience

- Dashboard Pelajar.
- Course learning page.
- Progress tracking.
- Continue learning.
- Learning history.

## Phase 4 — Community

- Discussion.
- Replies.
- Reactions.
- Moderation.
- Content report.

## Phase 5 — Analytics

- Activity tracking.
- Dashboard Master.
- User analytics.
- Course analytics.
- Drop-off analytics.
- Risk scoring.

## Phase 6 — Communication

- Announcement.
- In-app notification.
- Notification centre.

## Phase 7 — Reporting and Audit

- Report filters.
- CSV export.
- Audit log.
- Export log.

## Phase 8 — Quality Assurance

- Unit testing.
- Integration testing.
- End-to-end testing.
- Security testing.
- Performance testing.
- Responsive testing.
- User acceptance testing.
- Bug fixing.

---

## 24. Assumptions

- LMS digunakan oleh satu akademi.
- Kursus diberikan secara manual oleh Master.
- Belum ada transaksi pembayaran.
- Master juga bertindak sebagai pengelola materi.
- Belum ada role mentor atau instruktur.
- Materi berupa video, teks, PDF, dan tautan.
- Progres dihitung berdasarkan materi wajib.
- Forum hanya dapat diakses oleh peserta kursus terkait.
- Analytics menggunakan data aktivitas internal.
- Risk scoring menggunakan rule-based logic.
- Aplikasi berupa responsive web application.
- Bahasa utama adalah Bahasa Indonesia.
- Belum membutuhkan multi-language.
- Belum menggunakan multi-tenant architecture.

---

## 25. Risiko dan Mitigasi

### Risiko: Pengguna membuka materi tanpa benar-benar belajar

Mitigasi:

- Mencatat durasi aktivitas.
- Mencatat interaksi materi.
- Menggunakan syarat penyelesaian yang berbeda.
- Menambahkan quiz pada fase lanjutan.

### Risiko: Data analytics tidak akurat

Mitigasi:

- Menggunakan event naming yang konsisten.
- Mencegah event duplikat.
- Memisahkan session activity dan completion.
- Memvalidasi dashboard dengan data mentah.
- Menambahkan automated test untuk agregasi analytics.

### Risiko: Forum menjadi spam

Mitigasi:

- Rate limiting.
- Report system.
- Moderasi Master.
- Status hidden dan locked.
- Sanitasi input.

### Risiko: Video menggunakan penyimpanan besar

Mitigasi:

- Menggunakan object storage.
- Menggunakan layanan video streaming.
- Menyimpan URL video, bukan file langsung di application server.

### Risiko: Master sulit memahami dashboard

Mitigasi:

- Menampilkan insight yang actionable.
- Memberikan alasan pada risk indicator.
- Menghindari terlalu banyak metric dalam satu layar.
- Menyediakan drill-down ke detail pengguna atau materi.

### Risiko: Akses data tidak sah

Mitigasi:

- Server-side authorisation.
- Role-based access control.
- Ownership validation.
- Security review.
- Automated permission test.

---

## 26. Actionable Insight

Contoh insight yang perlu ditampilkan kepada Master:

- `12 pelajar tidak aktif selama lebih dari tujuh hari.`
- `Materi Strategi Konten memiliki drop-off tertinggi sebesar 38 persen.`
- `Delapan pengguna membuka materi yang sama lebih dari tiga kali.`
- `Mayoritas pengguna aktif pada pukul 19.00 sampai 22.00.`
- `Kursus Digital Marketing memiliki completion rate terendah.`
- `Topik Facebook Ads menjadi pertanyaan paling sering dibahas.`
- `Lima pengguna memiliki status High Risk.`

Setiap insight sebaiknya memiliki action:

- View users.
- View course.
- View lesson.
- Send announcement.
- Open discussion.
- Export data.

---

## 27. Definition of Done

Sebuah feature dianggap selesai apabila:

- Requirement sesuai PRD.
- Acceptance criteria terpenuhi.
- UI memiliki loading, empty, error, dan success state.
- Backend memiliki validasi dan authorisation.
- Database migration tersedia.
- Migration memiliki rollback.
- Automated test tersedia.
- Test berhasil dijalankan.
- Tidak ada temuan keamanan critical.
- Dokumentasi API diperbarui.
- Perubahan dicatat dalam changelog.
- Product Manager menyetujui hasil akhir.

---

## 28. Product Vision

LMS ini bukan hanya menjadi tempat menyimpan materi pembelajaran.

Platform harus membantu akademi memahami perjalanan belajar setiap pengguna.

Pelajar mendapatkan pengalaman belajar yang:

- Jelas.
- Terstruktur.
- Terukur.
- Interaktif.
- Mudah dilanjutkan.

Master mendapatkan insight untuk:

- Memperbaiki materi.
- Meningkatkan engagement.
- Mengurangi drop-off.
- Memahami kebutuhan pengguna.
- Menemukan pengguna yang membutuhkan bantuan.
- Mengambil keputusan berbasis data.
- Meningkatkan keberhasilan pembelajaran.

---

## 29. Software Development Subagents

Pengembangan LMS menggunakan satu orchestrator dan beberapa specialist subagent. Setiap subagent memiliki ownership yang jelas agar tidak terjadi tumpang tindih perubahan.

## 29.1 Engineering Manager and Orchestrator

### Tanggung Jawab

- Membaca PRD dan menentukan scope task.
- Memecah feature menjadi pekerjaan teknis.
- Menentukan subagent yang dibutuhkan.
- Menjaga urutan dependency.
- Menggabungkan temuan dari semua subagent.
- Menentukan status ready, blocked, atau needs revision.
- Menolak implementasi di luar scope.

### Tidak Boleh

- Mengimplementasikan seluruh feature sendiri.
- Mengubah requirement tanpa decision record.
- Menyatakan feature selesai tanpa evidence.

### Output

- Implementation plan.
- Task assignment.
- Dependency map.
- Consolidated review.
- Final completion report.

## 29.2 Product Manager and Business Analyst

### Tanggung Jawab

- Mengubah PRD menjadi epic, user story, dan acceptance criteria.
- Menjaga kesesuaian feature dengan kebutuhan target pengguna.
- Menentukan prioritas P0, P1, dan P2.
- Mengidentifikasi kebutuhan business owner, marketer, coding learner, AI learner, dan job seeker.
- Menentukan business rules.

### Output

- User stories.
- Acceptance criteria.
- Feature priority.
- Scope and non-scope.
- Requirement traceability.

## 29.3 Software Architect

### Tanggung Jawab

- Menentukan arsitektur aplikasi.
- Menentukan module boundary.
- Menyusun API contract.
- Menentukan authentication dan authorisation strategy.
- Menentukan event tracking architecture.
- Menentukan integration pattern.
- Membuat Architecture Decision Record.

### Output

- Architecture document.
- Module diagram.
- API contract.
- Data flow.
- ADR.
- Scalability and security considerations.

## 29.4 UI/UX Designer

### Tanggung Jawab

- Menyusun user flow Master dan Pelajar.
- Mendesain onboarding berdasarkan tujuan belajar.
- Mendesain dashboard, learning page, forum, dan analytics.
- Menentukan loading, empty, error, success, dan permission state.
- Menjaga pengalaman belajar mobile-friendly.

### Output

- User flow.
- Information architecture.
- Wireframe specification.
- Component state.
- Responsive behaviour.
- Accessibility notes.

## 29.5 Database Engineer

### Tanggung Jawab

- Membuat ERD.
- Menentukan table, field, relation, index, constraint, dan retention.
- Mengelola migration dan rollback.
- Menjaga integritas data progres dan activity log.
- Mengoptimalkan query analytics.
- Mencegah enrollment dan progress duplikat.

### Output

- ERD.
- Database schema.
- Migration.
- Rollback.
- Index strategy.
- Query examples.
- Data migration risk.

## 29.6 Backend Engineer

### Tanggung Jawab

- Mengimplementasikan API.
- Mengimplementasikan authentication dan role-based access control.
- Mengimplementasikan course, module, lesson, enrollment, progress, forum, notification, dan analytics.
- Menjaga server-side validation dan authorisation.
- Menulis unit dan integration test.
- Menjaga transaction dan idempotency.

### Output

- API implementation.
- Service and domain logic.
- Validation.
- Authorisation policy.
- Automated tests.
- Technical implementation report.

## 29.7 Frontend Engineer

### Tanggung Jawab

- Mengimplementasikan antarmuka Master dan Pelajar.
- Mengintegrasikan API.
- Membuat reusable components.
- Menyediakan semua UI state.
- Menjaga responsive design.
- Menambahkan frontend test.
- Tidak menjadikan frontend sebagai sumber kebenaran permission atau progres.

### Output

- Pages.
- Components.
- API integration.
- Responsive implementation.
- Accessibility implementation.
- Frontend tests.

## 29.8 Learning Analytics Engineer

### Tanggung Jawab

- Menentukan event taxonomy.
- Memvalidasi perhitungan active user, completion, drop-off, dan risk score.
- Menyusun aggregation query.
- Menjaga konsistensi dashboard dengan raw activity data.
- Menentukan segment analytics berdasarkan tujuan belajar.
- Menyusun data quality check.

### Output

- Event dictionary.
- Metric definition.
- Aggregation logic.
- Analytics query.
- Dashboard data contract.
- Data quality test.

## 29.9 QA Engineer

### Tanggung Jawab

- Menyusun test plan.
- Menguji functional requirements.
- Menguji role dan permission.
- Menguji progress calculation.
- Menguji forum ownership dan moderation.
- Menguji analytics.
- Menguji responsive behaviour.
- Melakukan regression testing.

### Output

- Test cases.
- Test evidence.
- Bug report.
- Regression checklist.
- Acceptance verification.

## 29.10 Security Reviewer

### Tanggung Jawab

- Melakukan review read-only.
- Memeriksa authentication dan session.
- Memeriksa IDOR dan privilege escalation.
- Memeriksa file upload.
- Memeriksa validation, XSS, CSRF, SQL injection, dan rate limiting.
- Memeriksa data exposure pada analytics dan export.

### Output

- Security finding.
- Severity.
- Attack scenario.
- Impact.
- Recommended fix.
- Verification method.

## 29.11 DevOps Engineer

### Tanggung Jawab

- Menyiapkan local, staging, dan production environment.
- Menyiapkan Docker.
- Menyiapkan CI/CD.
- Menjalankan migration.
- Menyiapkan backup dan restore.
- Menyiapkan logging, monitoring, dan health check.
- Menyediakan rollback deployment.

### Output

- Environment configuration.
- CI/CD pipeline.
- Deployment guide.
- Migration status.
- Monitoring setup.
- Backup and rollback procedure.

## 29.12 Technical Writer

### Tanggung Jawab

- Menjaga dokumentasi repository.
- Memperbarui README.
- Mendokumentasikan API dan setup.
- Menulis changelog.
- Menyusun user guide Master dan Pelajar.
- Menjaga glossary dan konsistensi istilah.

### Output

- README.
- Setup guide.
- API documentation.
- User guide.
- Changelog.
- Glossary.

## 29.13 Task Routing Matrix

| Jenis Task | Subagent Utama | Reviewer |
|---|---|---|
| Requirement baru | Product Manager | Orchestrator |
| Perubahan arsitektur | Software Architect | Security Reviewer |
| Perubahan database | Database Engineer | Backend Engineer |
| API dan business logic | Backend Engineer | QA Engineer |
| Dashboard dan learning page | Frontend Engineer | UI/UX Designer |
| Analytics dan risk scoring | Learning Analytics Engineer | Database Engineer dan QA |
| Authentication dan permission | Backend Engineer | Security Reviewer dan QA |
| Forum diskusi | Backend dan Frontend Engineer | QA dan Security |
| Deployment | DevOps Engineer | Orchestrator |
| Dokumentasi | Technical Writer | Product Manager |

## 29.14 Aturan Operasional Subagent

1. Semua agent wajib membaca bagian PRD yang relevan.
2. PRD menjadi sumber requirement utama.
3. API contract menjadi sumber kebenaran komunikasi frontend dan backend.
4. ERD menjadi sumber kebenaran struktur data.
5. Agent hanya mengubah file dalam ownership-nya.
6. Perubahan lintas domain harus melalui orchestrator.
7. Implementer tidak boleh menjadi satu-satunya reviewer.
8. Semua perubahan kode wajib memiliki test.
9. Tidak ada feature yang dinyatakan selesai tanpa acceptance evidence.
10. Temuan critical security harus diselesaikan sebelum release.
11. Agent read-only tidak boleh melakukan perubahan kode.
12. Semua keputusan arsitektur penting dicatat sebagai ADR.
13. Pekerjaan paralel hanya dilakukan apabila tidak menulis file yang sama.
14. Setiap output agent harus mencantumkan risiko dan unresolved issue.
15. Scope tambahan harus dikembalikan kepada Product Manager untuk prioritas.

