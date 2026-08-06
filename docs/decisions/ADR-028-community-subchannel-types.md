# ADR-028 — Tipe Sub-channel Komunitas

- Status: Accepted
- Tanggal: 6 Agustus 2026
- Pemilik keputusan: Product Owner
- Terkait: ADR-024, ADR-025, ADR-026

## Konteks

Sub-channel komunitas semula selalu disajikan sebagai ruang chat. Product Owner
meminta satu Channel dapat menampung bentuk interaksi berbeda seperti referensi
sidebar komunitas: percakapan cepat, post terstruktur, dan pengumuman resmi.

## Keputusan

`community_channels.type` memakai enum `CHAT`, `POSTS`, atau `ANNOUNCEMENTS`.
Data lama dan sub-channel baru tanpa pilihan eksplisit memakai `CHAT` agar
perilaku lama tetap kompatibel.

- `CHAT` memakai timeline pesan dan composer ringkas.
- `POSTS` memakai kartu feed beserta komentar dan reaksi.
- `ANNOUNCEMENTS` memakai kartu pengumuman. Hanya pemegang
  `discussions.moderate` dapat menerbitkan, dan komentar serta reaksi ditolak.

Semua tipe tetap memakai `community_posts`; tipe hanya menentukan aturan
interaksi dan penyajian, bukan membuat persistence paralel. Mengubah tipe tidak
menghapus isi lama. Server memaksa `isReadOnly=true` untuk pengumuman dan tetap
menegakkan aturan meskipun client mengirim nilai lain.

## Konsekuensi

- Kontrak create/update/list sub-channel membawa `type`.
- Database memerlukan migrasi enum dan kolom dengan default `CHAT`.
- Sidebar dan halaman channel menunjukkan ikon serta label tipe.
- Konten lama tetap dapat dibaca setelah perubahan tipe, tetapi pengumuman
  menolak komentar atau reaksi baru.
- Resource, course, event, atau forum khusus tidak dijadikan tipe sub-channel;
  kebutuhan itu memerlukan requirement dan model domain tersendiri.

## Security dan Observability

Permission berasal dari session. Larangan menulis, membalas, dan bereaksi pada
pengumuman diterapkan di service API. Mutasi moderasi yang sudah diaudit tetap
memakai aturan ADR-024; perubahan tipe tercakup dalam audit perubahan channel
yang berlaku saat ini.
