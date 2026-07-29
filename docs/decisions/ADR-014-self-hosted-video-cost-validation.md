# ADR-014: Self-hosted Video for Initial Cost Validation

## Status

Accepted.

## Context

ADR-013 memilih Bunny Stream sebagai provider utama karena kebutuhan transcoding,
adaptive streaming, CDN, dan proteksi distribusi. Product owner kemudian memilih
untuk memvalidasi biaya dan penggunaan nyata lebih dahulu dengan menyimpan video
di VPS Hostinger yang sudah tersedia.

Keputusan ini tidak menghapus kebutuhan abstraction provider. Self-hosted video
adalah mode rollout awal dengan kemampuan yang sengaja lebih terbatas, bukan
klaim bahwa file MP4 dapat diberi perlindungan setara DRM.

## Decision

Implementasi video tetap menggunakan port yang stabil:

```text
VideoProviderPort
├── SelfHostedVideoAdapter (rollout awal)
└── BunnyStreamAdapter (target migrasi ketika dibutuhkan)
```

Mode `SELF_HOSTED` memiliki aturan:

- Hanya MP4 browser-compatible (H.264 video dan AAC audio) yang diterima.
- File disimpan pada persistent volume khusus di luar public web root.
- Nama file asli tidak digunakan sebagai object key.
- Upload hanya dapat dilakukan Master dengan `courses.manage`.
- Upload menggunakan streaming I/O dan memiliki batas ukuran serta rate limit.
- API menyimpan metadata dan object key, bukan public permanent URL.
- Playback dibuat hanya setelah API memvalidasi account, enrollment, periode
  akses, course, lesson, dan prerequisite.
- File dilayani reverse proxy dari internal location setelah otorisasi API;
  volume bersifat read-only pada reverse proxy dan tidak dipublikasikan langsung.
- Playback session dan access URL memiliki TTL pendek dan tidak ditulis ke log.
- HTTP Range harus didukung agar browser dapat seek tanpa API memuat file ke
  memory.
- File video dan database harus dibackup ke failure domain berbeda dari VPS.
- Disk usage, bandwidth, error rate, dan kapasitas minimal harus dimonitor.

## Explicit Limitations

- Tidak ada automatic transcoding atau adaptive bitrate.
- Tidak ada CDN global.
- Tidak ada MediaCage/DRM atau domain restriction setara provider.
- Pengguna yang sah tetap dapat menangkap traffic atau merekam layar.
- Satu VPS menjadi failure domain untuk aplikasi dan video sampai backup
  direstore.
- Upload dan delivery video memakai bandwidth VPS.

Keterbatasan ini diterima untuk fase validasi biaya awal. UI dan dokumentasi
operasional tidak boleh menyebut mode ini anti-download atau DRM-protected.

## Migration Trigger

Evaluasi migrasi ke Bunny Stream jika salah satu kondisi terjadi:

- bandwidth atau disk mendekati 70% kuota selama periode operasional;
- playback buffering atau latency melewati target produk;
- dibutuhkan adaptive bitrate, transcoding, CDN, atau DRM;
- jumlah concurrent viewer tidak lagi aman untuk satu VPS;
- beban backup/restore video tidak dapat memenuhi RPO/RTO.

Migrasi dilakukan dengan menambah `BunnyStreamAdapter`, mengunggah object lama
secara asynchronous dan idempotent, lalu mengganti provider per asset. ID lesson
dan video internal tidak berubah.

## Consequences

- Biaya provider video dapat ditunda dan divalidasi dengan data nyata.
- Provider abstraction ADR-013 tetap berlaku; pilihan provider utamanya untuk
  rollout awal diubah oleh ADR ini.
- Production topology menambah persistent video volume dan internal media route.
- Backup off-site menjadi release blocker.
- Risiko bandwidth, durability, dan content redistribution lebih tinggi dan
  harus terlihat dalam monitoring serta runbook.

