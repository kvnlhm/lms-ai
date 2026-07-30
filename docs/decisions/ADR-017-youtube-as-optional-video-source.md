# ADR-017: YouTube sebagai Sumber Video Opsional per Pelajaran

## Status

Accepted.

Mengubah sebagian ADR-013. ADR-013 menolak YouTube unlisted sebagai provider
utama karena proteksi aksesnya lemah; penolakan itu tetap berlaku untuk peran
provider utama. ADR ini hanya menambahkan YouTube sebagai pilihan tambahan yang
dipilih sadar per pelajaran.

## Context

Master membutuhkan cara memuat materi video tanpa harus mengunggah berkas besar
ke VPS. Unggahan MP4 self-hosted memakai penyimpanan dan bandwidth server, dan
untuk kursus yang materinya memang sudah ada di YouTube, mengunggah ulang tidak
memberi manfaat apa pun.

ADR-013 menilai YouTube unlisted tidak layak menjadi provider utama karena
siapa pun yang memegang tautannya dapat menonton tanpa membeli kursus. Penilaian
itu tetap benar dan tidak dibantah oleh ADR ini.

## Decision

`VideoProvider` bertambah satu nilai: `YOUTUBE`.

Pemilihannya bersifat **per pelajaran**, bukan per deployment. Variabel
`VIDEO_PROVIDER` tetap hanya menentukan ke mana berkas diunggah, sehingga
menautkan YouTube tidak mengubah perilaku pelajaran lain.

Aset YouTube tidak memiliki berkas, sehingga `original_name`, `mime_type`, dan
`size_bytes` menjadi opsional. URL kanonis disimpan di `source_url`.

`provider_video_id` tetap diisi UUID internal, bukan ID YouTube, karena kolom
itu unik global — memakai ID YouTube akan melarang satu video dipakai di dua
pelajaran sekaligus.

Pemutaran memakai `youtube-nocookie.com/embed`, dan respons playback session
membedakan `kind: FILE` (dialirkan server ini) dari `kind: EMBED` (diputar
penyedia luar).

## Security Controls

- Playback session tetap dibuat hanya setelah enrollment dan akses lesson valid,
  sama seperti video self-hosted.
- Endpoint konten tidak pernah melayani aset YouTube: `playbackUrl` bernilai
  null untuk `kind: EMBED`.
- Tautan divalidasi ketat: hanya host YouTube yang dikenal, hanya skema http/https,
  dan ID wajib cocok dengan pola 11 karakter. Skema seperti `javascript:` dan
  host yang sekadar mengandung `youtube.com` ditolak.
- Embed memakai domain `youtube-nocookie` agar pelajar tidak dilacak sebelum
  menekan putar.

## Consequences

- **Kontrol akses melemah untuk pelajaran yang memakai YouTube.** Tautan unlisted
  dapat diteruskan dan ditonton tanpa membeli kursus. LMS tidak dapat mencegah
  ini; yang dapat dilakukan hanyalah memberi tahu Master saat menautkan.
- Penyimpanan dan bandwidth VPS tidak terpakai untuk video tersebut.
- Ketersediaan video bergantung pada YouTube dan kebijakan konten mereka.
- Analitik pemutaran milik LMS tidak melihat perilaku menonton di dalam iframe.
- Master dapat memilih per pelajaran: materi bernilai tinggi tetap self-hosted,
  materi pengantar boleh di YouTube.

## Alternatives

- Melarang YouTube sepenuhnya (status quo ADR-013): ditolak karena memaksa
  unggah ulang materi yang sudah ada dan membebani penyimpanan VPS.
- YouTube sebagai provider global menggantikan self-hosted: ditolak karena
  akan melemahkan proteksi seluruh kursus, bukan hanya yang dipilih.
- YouTube Private + OAuth per pelajar: ditolak karena menuntut setiap pelajar
  punya akun Google yang didaftarkan manual oleh Master.
