# ADR-031 — Checklist Komunitas Per Pengguna

- Status: Accepted
- Tanggal: 6 Agustus 2026
- Pemilik keputusan: Product Owner
- Menggantikan: ADR-030
- Terkait: ADR-024, ADR-025, ADR-028

## Konteks

Kategori `CHECKLIST` pada ADR-030 baru membedakan label ruang dan belum dapat
dicentang. Product Owner menetapkan bahwa setiap pelajar harus memiliki status
penyelesaian sendiri, bukan satu status global.

## Keputusan

- Setiap `community_post` aktif dalam sub-channel `CHECKLIST` merupakan satu
  item checklist.
- Tabel `community_checklist_completions` menyimpan pasangan unik `post_id` dan
  `user_id`. Keberadaan row berarti selesai; membatalkan centang menghapus row.
- API membaca user dari session dan mengembalikan `completedByMe`; client tidak
  boleh memilih user lain.
- Kontrol `allowReplies` dari ADR-030 tetap berlaku untuk tipe selain checklist.
- Item checklist tidak menerima komentar atau reaksi meskipun konfigurasi lama
  masih menyimpan `allowReplies=true`.
- Item checklist adalah konten terkelola. Pemegang `discussions.moderate` dapat
  menyunting item milik siapa pun; pengecualian ini tidak berlaku untuk post
  forum atau komentar biasa. Penyuntingan lintas pemilik dicatat di audit log.
- `community_posts.checklist_title` menyimpan judul item hingga 160 karakter,
  sedangkan `body` menyimpan konten multiline hingga 5.000 karakter. Daftar
  menampilkan judul sebagai tautan ke halaman bacaan khusus. Kontrol selesai
  ditempatkan setelah konten, dan navigasi berikutnya baru aktif setelah item
  dicentang. Tidak dibuat editor rich-text atau persistence paralel.
- Penyuntingan pindah ke halaman editor khusus. Satu item dapat memiliki satu
  `community_post_attachment` privat (JPG, PNG, WebP, MP4, WebM, atau PDF,
  maksimal 100 MB). Penggantian berkas tidak menumpuk attachment lama; browser
  mengambilnya lewat endpoint ber-session dan Nginx internal redirect.
- Channel hanya dapat dihapus permanen setelah diarsipkan. Penghapusan
  menghapus sub-channel dan seluruh konten turunannya melalui foreign key
  cascade, serta dicatat di audit log sebelum data dihapus.

## Konsekuensi

Checklist tidak menjadi penilaian, syarat kelulusan, atau authority progres
kursus. Ia hanya alat orientasi komunitas per pengguna. Penghapusan permanen
tidak dapat dipulihkan dari aplikasi dan membutuhkan backup untuk recovery.

## Security dan Observability

Status checklist selalu dibatasi pada user session. Endpoint hapus permanen
tetap membutuhkan `discussions.moderate`, menolak channel aktif, dan membuat
audit event `community.channel.delete_permanently`.
Penyuntingan item checklist milik pengguna lain membuat audit event
`community.checklist_item.update` dengan isi sebelum dan sesudah perubahan.
Unggah/penggantian dan penghapusan lampiran membuat event
`community.checklist_attachment.update` dan
`community.checklist_attachment.delete` tanpa mencatat isi berkas.
