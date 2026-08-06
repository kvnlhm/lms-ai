# ADR-030 — Checklist dan Kontrol Balasan Sub-channel

- Status: Superseded oleh ADR-031
- Tanggal: 6 Agustus 2026
- Pemilik keputusan: Product Owner
- Terkait: ADR-024, ADR-025, ADR-028

## Konteks

Master memerlukan kategori sub-channel ringkas untuk daftar orientasi seperti
“Welcome Checklist”. Master juga perlu menentukan aturan mengirim tulisan dan
aturan membalas secara terpisah; `isReadOnly` hanya menjawab aturan pertama.

## Keputusan

- Enum `CommunityChannelType` ditambah `CHECKLIST`.
- Checklist tetap memakai `community_posts`, sesuai batas persistence pada
  ADR-028. Kategori ini mengubah label dan penyajian ruang, bukan menjadi sistem
  tugas, penilaian, atau pelacakan progres baru.
- `community_channels.allow_replies` menentukan apakah post di sub-channel dapat
  menerima balasan. Nilai default `true` menjaga perilaku ruang lama.
- `ANNOUNCEMENTS` selalu memaksa `isReadOnly=true` dan `allowReplies=false` di
  server, walaupun client mengirim nilai lain.
- Master dapat mengubah `type`, `isReadOnly`, dan `allowReplies` dari form edit
  sub-channel yang sama.

## Konsekuensi

API daftar, pembuatan, dan perubahan sub-channel membawa `allowReplies`.
Composer balasan tidak ditampilkan ketika balasan ditutup dan API menolak
percobaan langsung dengan 403. Pengaturan tidak menghapus post atau balasan
lama.

## Security dan Observability

Larangan membalas ditegakkan oleh CommunityService berdasarkan data database,
bukan nilai yang dipercaya dari client. Perubahan tetap melalui endpoint admin
yang dilindungi `discussions.moderate` dan audit pengelolaan komunitas yang ada.
