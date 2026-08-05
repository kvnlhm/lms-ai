# ADR-027: Player Video Kustom tanpa Watermark Identitas

## Status

Accepted. Diminta langsung Product Owner pada 5 Agustus 2026.

## Context

ADR-013 menetapkan watermark identitas bergerak sebagai penghalang kebocoran.
Product Owner meminta nama akun tidak lagi ditampilkan di atas materi video dan
player mengikuti tema aplikasi. Pada saat yang sama, produk tetap ingin
mengurangi perekaman. Website tidak dapat mencegah screen recorder milik sistem
operasi atau kamera eksternal, sehingga janji anti-record absolut tidak valid.

## Decision

- Web tidak merender watermark nama, email, atau kode sesi di atas video.
- Video FILE dan HLS memakai player kustom bertema aplikasi.
- Player tidak menawarkan download, Picture-in-Picture, atau remote playback.
- Playback berhenti saat dokumen menjadi tersembunyi.
- Signed URL berumur singkat, validasi enrollment, dan playback session tetap
  menjadi kontrol akses utama.
- UI menyebut konten terlindungi tanpa menjanjikan DRM atau anti-record mutlak.
- Embed pihak ketiga tetap tunduk pada kemampuan dan kontrol penyedianya.

## Security Controls

- URL permanen tidak diekspos dan sesi hanya dibuat setelah otorisasi server.
- Tidak ada identitas pengguna yang ditempelkan pada frame atau rekaman.
- Context menu, PiP, cast, dan kontrol download kasual dibatasi bila browser
  mendukungnya.
- Perekaman layar OS dan perangkat eksternal dinyatakan sebagai residual risk.

## Consequences

- Tampilan lebih bersih dan konsisten dengan tema aplikasi.
- Kebocoran rekaman tidak lagi dapat ditelusuri melalui watermark pengguna.
- Kontrol ini mengurangi penyalinan kasual, bukan DRM.
- Bagian watermark pada ADR-013 tidak lagi berlaku; keputusan provider lainnya
  tetap berlaku.
