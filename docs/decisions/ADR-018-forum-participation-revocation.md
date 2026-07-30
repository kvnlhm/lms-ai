# ADR-018: Pencabutan Hak Berpartisipasi di Forum

## Status

Accepted.

Menambah cakupan PRD 7.12. Diminta product owner pada 30 Juli 2026 setelah PRD
awal disusun.

## Context

PRD 7.12 memberi Master kewenangan atas **konten**: menyembunyikan, mengunci,
menghapus, dan meninjau laporan. Semuanya bekerja setelah kerusakan terjadi.

Yang tidak dimiliki Master adalah kewenangan atas **orang**. Pelajar yang terus
berkomentar buruk hanya dapat dihadapi dengan menghapus tulisannya satu per
satu, sementara ia bebas menulis lagi. Satu-satunya tindakan yang tersedia
adalah menonaktifkan seluruh akunnya, yang sekaligus mencabut akses belajar
yang sudah ia bayar — hukuman yang tidak sebanding.

## Decision

Tabel `forum_bans` mencatat pencabutan hak berpartisipasi.

Cakupannya dua tingkat: `course_id` terisi berarti hanya di forum kursus itu,
`course_id` null berarti di seluruh forum.

Yang dicabut hanya **hak menulis**. Pelajar yang dicabut haknya tetap dapat
membaca forum dan mengikuti seluruh materi kursusnya, karena itu yang ia beli.
Ia juga tetap dapat **melaporkan** konten — justru pelajar bermasalah pun harus
bisa melaporkan penyalahgunaan yang menimpa dirinya.

Pencabutan dapat dibatasi waktu lewat `expires_at`, atau berlaku sampai
dikembalikan Master.

Mengembalikan hak dilakukan dengan mengisi `revoked_at`, bukan menghapus baris,
sehingga riwayat moderasi tetap utuh dan dapat diperiksa kemudian.

Hanya satu pencabutan aktif per cakupan yang diizinkan; menumpuknya akan
membuat pengembalian hak menjadi ambigu.

## Security Controls

- Endpoint moderasi dijaga permission `discussions.moderate`, yang pada MVP
  hanya dimiliki role MASTER.
- Master tidak dapat mencabut hak dirinya sendiri.
- Pemeriksaan dilakukan di service, bukan di antarmuka: `canParticipate` yang
  dikirim ke klien hanya untuk menyembunyikan kotak balasan lebih awal, dan
  tidak pernah menjadi dasar keputusan server.
- Pencabutan yang kedaluwarsa berhenti berlaku tanpa perlu pekerjaan
  terjadwal, karena `expires_at` diperiksa saat penegakan.

## Consequences

- Master memiliki tindakan yang sebanding untuk pelanggaran berulang, tanpa
  harus mencabut akses belajar berbayar.
- Riwayat moderasi dapat diaudit karena pencabutan tidak pernah dihapus.
- Pelajar yang dicabut haknya tetap melihat forum, sehingga dapat merasa
  diperlakukan tidak adil tanpa penjelasan. Karena itu `reason` wajib diisi dan
  dikembalikan kepada pelajar dalam pesan penolakan.
- Belum ada notifikasi otomatis saat hak dicabut atau dikembalikan; untuk saat
  ini pelajar baru mengetahuinya ketika mencoba menulis.

## Alternatives

- Menonaktifkan akun: ditolak karena ikut mencabut akses belajar berbayar.
- Menghapus konten satu per satu: ditolak karena tidak menghentikan pengulangan.
- Moderasi antrean (setiap tulisan menunggu persetujuan): ditolak untuk MVP
  karena menuntut Master hadir terus-menerus dan memperlambat semua pelajar,
  bukan hanya yang bermasalah.
