# ADR-015: Self-hosted Public Images for Initial Production

- Status: Accepted
- Date: 2026-07-30

## Context

Deployment awal menggunakan satu VPS dan persistent Docker volumes untuk menekan biaya.
Foto profil sudah mengikuti pola ini. Thumbnail kursus bersifat publik, kecil, dan tidak
memerlukan transcoding atau signed playback seperti video.

## Decision

Foto profil dan thumbnail kursus pada fase produksi awal disimpan pada volume persisten
terpisah dan disajikan melalui endpoint NestJS dengan nama file acak.

- Database menyimpan URL relatif aktif.
- Penggantian file menghasilkan URL baru agar immutable caching aman.
- MIME, ukuran, dan magic bytes diverifikasi sebelum file diaktifkan.
- Hanya Master dengan `courses.manage` yang dapat mengubah thumbnail.
- Implementasi tetap dibatasi oleh service aplikasi agar dapat diganti dengan
  S3-compatible object storage tanpa mengubah kontrak web.

## Consequences

- Backup VPS wajib mencakup volume thumbnail.
- Horizontal scaling memerlukan shared object storage atau shared filesystem.
- Endpoint file publik menambah sedikit beban ke API, tetapi dapat dipindahkan ke CDN
  saat trafik meningkat.
- Migrasi ke `media_assets` tetap menjadi opsi ketika media management umum dibuat.
