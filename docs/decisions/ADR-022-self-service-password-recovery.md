# ADR-022: Self-Service Password Recovery

## Status

Accepted.

## Context

`API_CONTRACT.md` sudah mencantumkan `POST /auth/forgot-password` sejak awal,
tetapi endpoint itu tidak pernah dibuat karena belum ada provider email. Yang
tersedia hanya endpoint administratif untuk menerbitkan tautan secara manual,
sehingga Pelajar yang lupa password harus menghubungi Master lebih dulu.

Sejak 31 Juli 2026 akademi menerima pendaftaran berbayar dan Resend sudah
aktif di produksi, jadi hambatan aslinya sudah hilang.

Pengiriman email waktu itu hanya ada di dalam modul commerce sebagai bagian
dari notifikasi aktivasi. Identity tidak boleh bergantung pada commerce hanya
untuk mengirim surat.

## Decision

- `EmailService` diangkat ke `shared/email` sebagai satu-satunya jalan keluar
  email dari API, beserta templatenya. Konfigurasi pindah dari `commerce.email`
  ke `email` pada tingkat atas; nama environment variable tidak berubah.
- `POST /auth/forgot-password` bersifat publik dan membalas badan yang sama
  untuk alamat terdaftar maupun tidak.
- Pengiriman email tidak ditunggu sebelum membalas.
- Pembatas laju dua lapis: per alamat dan per IP, menghitung setiap permintaan.
- Hanya akun `ACTIVE` yang menerima tautan.
- Tautan memakai mekanisme token yang sudah ada: sekali pakai, hanya hash yang
  disimpan, masa berlaku `PASSWORD_RESET_TTL_MINUTES`. Permintaan baru
  membatalkan tautan sebelumnya.
- Endpoint administratif tidak berubah dan tidak mengirim email, sehingga
  Master tetap dapat menangani kasus dukungan tanpa memicu surat ke pengguna.

## Security Consequences

- Balasan seragam saja tidak cukup. Menunggu pengiriman email akan membuat
  permintaan untuk alamat terdaftar berlangsung jelas lebih lama daripada yang
  tidak terdaftar, dan selisih waktu itu memulihkan kebocoran yang justru
  hendak ditutup. Karena itu pengirimannya dilepas ke latar belakang.
- Menghitung hanya permintaan yang "gagal" tidak mungkin di sini, karena tidak
  ada kegagalan yang terlihat dari luar. Setiap permintaan harus dihitung.
- Lapis per alamat dan per IP menutup dua penyalahgunaan berbeda: membanjiri
  satu kotak masuk, dan memindai banyak alamat dari satu sumber.
- Akun yang ditangguhkan tidak dapat memulihkan diri sendiri, sehingga
  penangguhan tidak dapat dilewati lewat jalur ini.
- Kegagalan pengiriman hanya masuk log aplikasi; isinya tidak pernah
  memuat token.

## Consequences

- Beban dukungan Master berkurang: pemulihan password tidak lagi memerlukan
  campur tangan manusia.
- Email menjadi kemampuan bersama, sehingga jenis surat berikutnya tidak perlu
  menembus batas modul lagi.
- Deployment tanpa provider email tetap berjalan: `EMAIL_PROVIDER=DISABLED`
  membuat pengiriman menjadi `SKIPPED`, endpoint tetap membalas seragam, dan
  jalur administratif tetap tersedia.
