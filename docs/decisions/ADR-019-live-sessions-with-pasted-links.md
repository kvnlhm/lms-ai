# ADR-019: Sesi Langsung dengan Tautan yang Ditempel Manual

## Status

Accepted.

Memindahkan "Live class" dari PRD 4.2 (Tidak Termasuk dalam MVP) ke dalam
cakupan, tetapi hanya sebagian. "Integrasi Zoom atau Google Meet" pada baris
yang sama tetap **di luar cakupan**.

## Context

Product owner meminta fitur livestream. PRD 4.2 mengeluarkan Live class dari
MVP dan roadmap menempatkannya di P2, alasan aslinya: integrasi penyedia rapat
menuntut OAuth, webhook, penyimpanan kredensial, dan penanganan kedaluwarsa
token — pekerjaan sebesar satu modul tersendiri.

Namun alasan itu hanya berlaku untuk **integrasinya**, bukan untuk kebutuhan
yang ingin dijawab. Yang sebenarnya dibutuhkan pelajar cukup dua hal: tahu
kapan kelasnya berlangsung, dan punya tombol untuk masuk.

## Decision

LMS menyimpan jadwal dan tautan, tidak memanggil API penyedia mana pun.

Master membuat rapat sendiri di Zoom atau Meet, lalu menempel tautannya. Tidak
ada kredensial penyedia yang disimpan, tidak ada OAuth, tidak ada webhook.

Tautan divalidasi terhadap daftar host tertutup: `zoom.us`, `zoomgov.com`,
`meet.google.com`, `teams.microsoft.com`, `teams.live.com`, `whereby.com`,
`meet.jit.si`, beserta subdomainnya. Wajib `https`.

Tombol gabung terbuka 15 menit sebelum sesi mulai, dan tautannya berhenti
dikirim ke klien setelah sesi berakhir.

Pembatalan mengisi `cancelled_at`, bukan menghapus baris.

## Security Controls

- Jadwal hanya dapat dibaca pelajar dengan enrollment aktif pada kursus itu;
  kursus yang tidak dimiliki dijawab `404`.
- Penjadwalan dan pembatalan menuntut permission `courses.manage`.
- **Daftar host tertutup adalah kontrol keamanan, bukan sekadar validasi
  bentuk.** Kolom ini disiarkan ke seluruh peserta kursus, sehingga tanpa
  pembatasan ia menjadi sarana menyebarkan tautan apa pun — termasuk phishing —
  dengan kredibilitas yang dipinjam dari akademi.
- Pencocokan host dilakukan persis atau lewat akhiran `.host`, sehingga
  `zoom.us.phishing.test` ditolak.
- `http` ditolak karena tautan rapat akan melintas terbuka di jaringan.
- Tautan tidak lagi dikirim ke klien setelah sesi berakhir, agar tautan lama
  tidak terus beredar.

## Consequences

- Master mengerjakan dua langkah: membuat rapat di penyedia, lalu menempelkan
  tautannya. Tidak ada pembuatan rapat otomatis.
- LMS tidak mengetahui kehadiran, durasi tonton, maupun rekaman. Insight
  pembelajaran tidak mencakup sesi langsung.
- Tidak ada pengingat otomatis menjelang sesi; menyusul bersama modul
  notifikasi.
- Penyedia di luar daftar memerlukan perubahan kode. Ini disengaja — menambah
  host adalah keputusan keamanan, bukan konfigurasi.
- Kalau nanti integrasi penuh dibutuhkan, model `LiveSession` sudah menyediakan
  tempatnya dan dapat diperluas tanpa migrasi yang merusak.

## Alternatives

- Integrasi penuh Zoom API: ditolak untuk sekarang karena lingkupnya sebesar
  satu modul, sementara nilainya bagi pelajar hampir sama.
- Menaruh tautan pada materi bertipe `EXTERNAL_LINK`: ditolak karena tidak
  punya waktu mulai, durasi, status, maupun pembatalan — jadwal akan tercampur
  dengan silabus.
- Mengizinkan URL apa pun: ditolak, lihat Security Controls.
