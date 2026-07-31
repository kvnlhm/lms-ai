# ADR-020: Configurable Master MFA

## Status

Accepted.

## Context

Baseline keamanan mewajibkan TOTP untuk role Master. Product Owner meminta
deployment awal dapat masuk tanpa kode aplikasi autentikator karena hambatan
operasional. Menghapus implementasi MFA sepenuhnya akan menyulitkan aktivasi
ulang ketika operasi sudah siap.

## Decision

Kewajiban MFA Master dikendalikan oleh `REQUIRE_MASTER_MFA`.

- Default tetap `true`.
- Jika `false`, login Master langsung menghasilkan session penuh setelah
  verifikasi kata sandi dan pemeriksaan status akun.
- Metode MFA yang sudah tersimpan tidak dihapus dan akan digunakan kembali
  ketika flag diaktifkan.
- Endpoint setup/verify MFA tetap tersedia hanya untuk session yang memang
  ditandai pending oleh kebijakan aktif.

## Security Controls

- Password hashing, login rate limit, opaque server-side session, CSRF, status
  akun, permission, audit, dan session revocation tetap aktif.
- Nilai `false` merupakan accepted risk per deployment, bukan default produk.
- Akses Coolify, VPS, dan akun Master harus memakai kredensial unik yang kuat.
- MFA harus diaktifkan kembali sebelum jumlah operator Master bertambah atau
  akses administratif diberikan kepada pihak lain.

## Consequences

- Login deployment terpilih tidak lagi meminta kode autentikator.
- Risiko account takeover meningkat jika kata sandi Master bocor.
- Aktivasi ulang MFA cukup mengubah environment variable dan redeploy tanpa
  migrasi database.
