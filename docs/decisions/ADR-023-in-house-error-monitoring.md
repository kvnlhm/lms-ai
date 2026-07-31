# ADR-023: Pemantauan Galat Dibangun Sendiri

## Status

Accepted.

## Context

PRD 12.7 mensyaratkan "Sistem memiliki error logging", dan
`ENVIRONMENT_VARIABLES.md` sudah lama mencantumkan `SENTRY_DSN` beserta
sekumpulan variabel OpenTelemetry. Tidak satu pun pernah dipasang.

Akibatnya, sampai 31 Juli 2026 galat runtime hanya berakhir di log container.
Log itu hilang setiap deploy, tidak dapat dicari, dan tidak ada yang membacanya
kecuali sedang mencari sesuatu. Bug webhook Midtrans yang membalas 500 selama
berhari-hari ditemukan secara kebetulan saat log dibaca untuk keperluan lain —
bukan karena ada yang memberi tahu.

Akademi ini sudah menerima pembayaran. Kegagalan pada alur pendaftaran atau
pemutaran video berarti kehilangan uang dan kepercayaan, dan mengetahuinya dari
keluhan pelanggan selalu terlambat.

Sentry adalah pilihan yang wajar dan lebih matang. Tetapi memasangnya menuntut
pendaftaran akun, DSN, dan keputusan pemilik produk soal mengirim jejak
tumpukan berisi data produksi ke pihak ketiga.

## Decision

Membangun pencatatan galat di dalam sistem sendiri.

- Tabel `error_events`, satu baris per jenis galat. Fingerprint dihitung dari
  sumber, kelas exception, pesan yang dinormalkan, bingkai tumpukan pertama
  milik kode sendiri, dan rute.
- Tiga sumber: `AllExceptionsFilter` untuk 5xx API, `global-error.tsx` dan
  `instrumentation.ts` untuk web, event `failed` BullMQ untuk worker.
- Peringatan email hanya untuk fingerprint baru atau yang muncul kembali
  setelah ditutup, dengan anggaran surat per jam.
- Endpoint publik `POST /telemetry/client-errors` untuk laporan browser,
  dibatasi per IP dan payloadnya dibatasi ketat.
- Halaman `/master/errors` dengan permission `audit.read`.

`SENTRY_DSN` dan variabel OpenTelemetry tetap disebut di dokumentasi, tetapi
sekarang ditandai eksplisit sebagai belum terpasang.

## Consequences

- Tidak ada akun baru, tidak ada biaya langganan, dan tidak ada data produksi
  yang meninggalkan VPS.
- Kegagalan menjadi terlihat tanpa menunggu ada yang mengeluh.
- Pengelompokan per fingerprint, bukan per kejadian, membuat satu bug pada
  endpoint ramai tetap satu baris. Menyimpan tiap kejadian akan membuat tabel
  ini menjadi beban tersendiri justru saat sistem sedang bermasalah.
- Yang tidak didapat dibanding Sentry: source map untuk membaca jejak tumpukan
  bundel produksi, pelacakan rilis, pengelompokan lintas layanan, dan
  pemberitahuan selain email. Bila kebutuhannya tumbuh ke sana, tabel ini tidak
  menghalangi — Sentry dapat dipasang berdampingan.
- Endpoint laporan browser bersifat publik, dan itu memang permukaan serang
  baru. Mitigasinya batas laju per IP, payload terbatas, `source` dan waktu
  ditentukan server, serta anggaran surat yang menahan sisi pemberitahuan.

## Security Consequences

- `context` tidak boleh memuat email, nama, atau isi payload pengguna. Galat
  bukan tempat penyimpanan PII baru; yang disimpan hanya pengenal teknis.
- Query pada path dibuang sebelum dilaporkan, karena halaman undangan dan
  pemulihan password membawa token di query.
- Rute dinormalkan menjadi pola (`/users/:id`), sehingga ID tidak masuk ke
  fingerprint maupun konteks.
- Pembacaan memerlukan `audit.read`; jejak tumpukan dapat mengungkap struktur
  internal dan tidak boleh terlihat oleh Pelajar.
- Pencatatan tidak pernah melempar. Kegagalan mencatat galat tidak boleh
  menambah kegagalan di atas kegagalan yang sedang terjadi.
