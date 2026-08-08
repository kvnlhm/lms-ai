-- Tujuan token baru untuk pembuktian alamat email pendaftar gratis (ADR-032).
--
-- Menambah nilai enum tidak menyentuh satu pun baris yang sudah ada, dan tidak
-- dapat dibatalkan dalam satu transaksi pada PostgreSQL — karena itu ia berdiri
-- sebagai migrasi tersendiri, terpisah dari perubahan tabel.
ALTER TYPE "CredentialTokenPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION';
