# ADR-029 — Balasan Forum Satu Tingkat

- Status: Accepted
- Tanggal: 6 Agustus 2026
- Pemilik keputusan: Product Owner
- Terkait: ADR-018

## Konteks

Balasan forum sebelumnya datar sehingga hubungan antara pertanyaan dan tanggapan
tidak terlihat. Product Owner meminta model percakapan bercabang seperti
referensi visual yang diberikan.

## Keputusan

`forum_replies.parent_reply_id` boleh menunjuk satu balasan utama dalam topik
yang sama. Balasan anak tidak dapat memiliki anak lagi. Antarmuka menampilkan
garis thread, identitas tujuan, dan kontrol buka/tutup balasan anak.

## Konsekuensi

- Data lama tetap menjadi balasan utama karena nilai default-nya null.
- Kedalaman dibatasi satu tingkat agar percakapan tetap terbaca dan kontrak API
  tidak memerlukan struktur rekursif.
- Permission, reaksi, laporan, edit, hapus, dan moderasi tetap mengikuti aturan
  forum yang sudah ada.
