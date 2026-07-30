# ADR-016 — Registration Commerce and Access Tiers

Status: Accepted  
Date: 2026-07-30

## Context

Baseline PRD tidak mencakup payment gateway dan WhatsApp. Product owner kemudian
meminta secara eksplisit pendaftaran publik dengan pembayaran sekali saat
daftar, paket 6 bulan, 12 bulan, atau lifetime, dan aktivasi melalui email serta
WhatsApp. Seluruh atribut paket harus dapat diubah oleh Master.

## Decision

- Pembayaran memakai Midtrans Snap dengan integrasi backend.
- Harga tersimpan sebagai integer Rupiah. `duration_months = NULL` berarti
  lifetime.
- Paket dapat berisi satu atau lebih kursus. Pembayaran yang sah memberikan
  enrollment untuk seluruh kursus paket.
- Webhook hanya diproses setelah signature SHA-512 valid dan status diambil
  kembali dari Midtrans. Event webhook memiliki idempotency key unik.
- Pembuatan/penggunaan akun, enrollment, progress awal, order `PAID`, dan outbox
  event dilakukan dalam satu transaksi database.
- Password tidak pernah dikirim. Pengguna baru menerima tautan undangan sekali
  pakai untuk menentukan password sendiri.
- Email memakai Resend. WhatsApp memakai template Meta WhatsApp Cloud API.
- Kegagalan provider komunikasi tidak membatalkan pembayaran atau enrollment.
  Status pengiriman dicatat agar dapat ditindaklanjuti.
- Secret provider hanya berasal dari environment/secret manager.

## Consequences

- Modul `commerce` menjadi pemilik paket, order, dan webhook pembayaran.
- Midtrans Server Key tidak pernah masuk browser; Client Key boleh diberikan
  bersama respons checkout untuk memuat Snap.
- Refund dicatat, tetapi pencabutan akses otomatis setelah refund belum
  dilakukan pada versi awal dan memerlukan kebijakan operasional tersendiri.
- Template WhatsApp harus disetujui Meta sebelum pengiriman produksi berhasil.

