# ADR-024: Feed Komunitas dan Channel yang Dikelola Master

## Status

Accepted. Diminta langsung Product Owner pada 3 Agustus 2026.

## Context

Forum yang ada selalu terikat kursus. Beranda Pelajar membutuhkan feed lintas
kursus, sedangkan sidebar membutuhkan ruang percakapan yang dapat diberi nama,
diurutkan, dibuat read-only, dan diarsipkan tanpa membuat kursus palsu.

## Decision

Domain `Community` berdiri di dalam modular monolith dengan empat tabel:
channel, post, comment, dan reaction. Seluruh pengguna aktif dapat membaca.
Pengguna aktif dapat menulis kecuali channel read-only; Master tetap dapat
menulis di channel read-only. Pembuatan, perubahan, dan pengarsipan channel
menggunakan permission `discussions.moderate` dan tidak pernah dipercaya dari
UI.

Halaman Community dan Beranda menggabungkan data melalui composition pada
Next.js: post berasal dari Community, sedangkan pengumuman dan sesi langsung
tetap berasal dari domain asalnya. Beranda tetap memakai endpoint enrollment
dan learning progress sebagai dashboard belajar, lalu menampilkan cuplikan
feed, event, dan pengumuman. Navigasi channel ditempatkan pada shell Pelajar
agar persisten lintas halaman. Community tidak mengakses persistence private
modul lain.

## Security Controls

- Semua endpoint dilindungi session aktif.
- Mutation channel memerlukan `discussions.moderate`.
- Panjang slug, nama, deskripsi, post, dan komentar divalidasi di server.
- Slug dinormalisasi server dan unik di database.
- Reaction memakai primary key gabungan agar toggle idempoten secara state.
- Penghapusan konten memakai soft delete; pengarsipan channel mempertahankan
  histori.
- Menyunting dan menghapus adalah dua kewenangan berbeda. Menyunting hanya
  milik penulisnya, bahkan terhadap pemegang `discussions.moderate`, karena
  moderasi berarti kuasa menghapus yang tidak pantas dan bukan kuasa menulis
  ulang ucapan orang lain. Menghapus tulisan orang lain selalu tercatat di
  audit log beserta isi aslinya.
- Perubahan tulisan mengisi `edited_at` dan ditampilkan sebagai penanda
  "diedit"; percakapan yang dapat berubah diam-diam setelah dibaca orang lain
  lebih buruk daripada percakapan yang tidak dapat diubah sama sekali.
- Feed dan percakapan channel memakai urutan berbeda. Feed menjawab "apa yang
  sedang ramai" sehingga memakai tersemat lalu `last_activity_at`; percakapan
  channel menjawab "apa yang terjadi, berurutan" sehingga memakai `created_at`
  menurun dengan `id` sebagai pemutus seri. Memakai `last_activity_at` di
  percakapan membuat pesan lama melompat ke posisi terbaru saat dibalas.
- Menyematkan adalah kewenangan moderasi, terpisah dari menyunting dan
  menghapus, dan berlaku juga atas tulisan sendiri. Sematan sebuah channel
  diambil lewat daftar tersendiri, bukan ikut halaman percakapan: yang layak
  disematkan justru pesan yang sudah lama lewat dari layar, sehingga ikut
  halaman berarti ikut tergulung hilang. Bilahnya melekat di puncak linimasa
  yang tergulung, bukan menjadi baris grid tersendiri.
- Pratinjau balasan pada daftar tulisan membawa enam yang **terakhir**, dan
  seluruh balasan dapat diambil dari endpoint tersendiri. Sebelumnya pratinjau
  membawa enam yang pertama tanpa jalan ke sisanya, sehingga percakapan yang
  ramai justru paling banyak menyembunyikan isinya.
- HTML tidak diterima; body ditampilkan sebagai teks oleh React.

## Consequences

- Feed tidak lagi bergantung pada enrollment atau keberadaan kursus.
- Sesi langsung dan pengumuman tidak diduplikasi ke tabel feed.
- MVP memakai refresh berkala lima detik saat tab terlihat dan pagination,
  belum WebSocket. UI menyebutnya "diperbarui otomatis", bukan "online" atau
  "realtime", karena belum ada jaminan delivery instan maupun presence.
  Realtime penuh dan attachment memerlukan keputusan lanjutan tentang
  kapasitas, moderasi, fan-out, reconnect, dan storage.
