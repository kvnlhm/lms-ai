# ADR-021: Read-Only Student Impersonation

## Status

Accepted.

## Context

Master perlu memeriksa pengalaman nyata seorang Pelajar untuk membantu masalah
akses dan pembelajaran tanpa meminta password atau mengambil alih kredensial.

## Decision

- Hanya Master dengan `users.security.manage` dapat memulai pratinjau.
- Target wajib akun `STUDENT` aktif.
- Sistem membuat opaque session terpisah berumur maksimum 30 menit dengan role
  dan permission Pelajar target.
- Opaque session Master semula tetap tersimpan server-side dan dipulihkan saat
  pratinjau diakhiri.
- Semua mutation ditolak selama pratinjau, kecuali endpoint untuk mengakhirinya.
- UI selalu menampilkan banner pratinjau dan tombol kembali sebagai Master.
- Mulai dan akhir pratinjau dicatat pada audit log.

## Security Consequences

- Master tidak pernah menerima password, MFA secret, atau session pengguna.
- Pelarangan mutation mencegah Master membuat progres, forum, atau perubahan
  profil seolah dilakukan Pelajar.
- Jika session Master semula kedaluwarsa, Master wajib login kembali.
- Feature tidak tersedia untuk target Master sehingga tidak menjadi jalur
  eskalasi antar akun administratif.
