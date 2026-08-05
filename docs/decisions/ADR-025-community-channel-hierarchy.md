# ADR-025: Hierarki Channel dan Sub-channel Komunitas

## Status

Accepted. Diminta langsung Product Owner pada 5 Agustus 2026.

## Context

Community pada ADR-024 memakai satu tingkat: setiap channel langsung merupakan
ruang chat. Product Owner menetapkan bahwa channel hanya berfungsi sebagai nama
atau kelompok. Saat dibuka, channel menampilkan beberapa sub-channel, dan hanya
sub-channel yang merupakan ruang chat.

## Decision

- Tambahkan entitas induk `CommunityChannelGroup` yang ditampilkan sebagai
  **Channel** kepada pengguna.
- Entitas `CommunityChannel` yang sudah ada menjadi **Sub-channel** dan tetap
  menjadi pemilik post, pengaturan read-only, urutan, arsip, serta relasi audit.
- Channel induk memiliki nama, slug, deskripsi, urutan, status arsip, dan pembuat,
  tetapi tidak dapat menerima post.
- URL `/community/{channelSlug}` menampilkan daftar sub-channel.
- URL `/community/{channelSlug}/{subchannelSlug}` membuka ruang chat.
- Slug Channel unik di antara Channel. Slug Sub-channel unik di dalam satu
  Channel, bukan global.
- Master dengan `discussions.moderate` mengelola kedua tingkat. Permission tidak
  pernah ditentukan client.
- Menghapus Channel induk berarti mengarsipkan induk beserta seluruh
  sub-channel secara efektif dari tampilan. Data tidak dihapus permanen.
- Channel lama dimigrasikan tanpa kehilangan percakapan: setiap row lama menjadi
  Channel induk bernama sama, sedangkan row lama itu sendiri menjadi sub-channel
  `Umum`. Post tetap menunjuk row yang sama.

## Security Controls

- Seluruh endpoint tetap membutuhkan session aktif.
- Mutation Channel dan Sub-channel membutuhkan `discussions.moderate`.
- Server memvalidasi bahwa Sub-channel berada di bawah Channel pada URL.
- Membuat post hanya menerima ID Sub-channel; ID penulis berasal dari session.
- Arsip dan pemulihan tetap dicatat di audit log.

## Consequences

- Kontrak daftar channel berubah menjadi struktur bersarang.
- Feed tetap menggabungkan post lintas seluruh Sub-channel aktif.
- Tautan chat lama tidak lagi menjadi tujuan akhir, tetapi slug lama tetap
  menunjuk Channel induk agar bookmark tidak menjadi 404.
- Realtime dan kedalaman lebih dari dua tingkat tetap di luar cakupan.
