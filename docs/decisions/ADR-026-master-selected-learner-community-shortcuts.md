# ADR-026: Pintasan Komunitas Pelajar Dipilih Master

## Status

Accepted. Diminta langsung Product Owner pada 5 Agustus 2026.

## Context

ADR-025 menetapkan hierarki Channel dan Sub-channel, tetapi seluruh Channel
aktif otomatis memenuhi sidebar Pelajar. Product Owner meminta Master dapat
memilih Channel dan Sub-channel yang layak menjadi pintasan, seperti daftar
ruang yang dikelompokkan pada referensi mobile.

## Decision

- Channel dan Sub-channel memiliki `showInSidebar`, default `true` agar migrasi
  tidak menghilangkan navigasi yang sudah ada.
- Sidebar hanya mengambil Channel serta Sub-channel aktif yang dipilih Master.
- Channel di sidebar merupakan accordion; sub-channel adalah tautan langsung
  ke ruang chat dan hanya dirender saat accordion dibuka.
- Menyembunyikan pintasan tidak mengarsipkan atau mengubah izin akses. Konten
  tetap tersedia dari halaman Komunitas dan URL yang sah.
- Master mengatur pilihan melalui endpoint moderasi yang sudah dilindungi
  `discussions.moderate`.
- Channel baru wajib dibuat bersama minimal satu Sub-channel. Sub-channel aktif
  terakhir tidak dapat diarsipkan selama Channel induknya masih aktif.

## Security Controls

- Client tidak menentukan permission; endpoint mutation tetap memeriksa session
  dan `discussions.moderate`.
- Pintasan hanya dapat mengarah ke Channel/Sub-channel internal yang ada. URL
  bebas atau eksternal tidak disimpan.

## Consequences

- Ada dua daftar baca: seluruh Channel aktif untuk halaman Komunitas, dan
  subset pilihan Master untuk sidebar.
- Form pembuatan lebih panjang sedikit, tetapi tidak lagi menghasilkan Channel
  kosong yang sulit dipahami.
