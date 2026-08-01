# Post-Incident Review — 31 Juli 2026

Produksi tidak melayani selama ±9 menit setelah deploy gagal.

Mengikuti `INCIDENT_RESPONSE.md` §7. Review bersifat blameless dan berfokus
pada sistem.

## Severity

**SEV-2.** Seluruh akademi tidak dapat diakses, tetapi tidak ada data yang
hilang atau rusak, dan tidak ada indikasi akses tidak sah.

## Timeline (UTC)

| Waktu | Kejadian |
|---|---|
| 16:28 | Backup pra-deploy diambil dan diverifikasi checksum-nya |
| 16:30 | Deploy commit `86af5e6` dipicu |
| ±16:31 | `docker compose up` mengganti container; web dan gateway berhenti |
| 16:33 | Container API mulai crash-loop |
| 16:35 | Coolify mengirim surat "Deployment failed" |
| 16:36 | Deploy ditandai `failed`; situs membalas 503 |
| 16:37 | Penyebab ditemukan dari log container API |
| 16:38 | Perbaikan `13a20fe` di-push |
| 16:39 | Deploy ulang dipicu |
| 16:40 | API menyala; situs melayani kembali |
| 16:48 | Deploy ditandai `finished`; verifikasi penuh dijalankan |

## Root cause

`apps/api/src/bootstrap.ts` menambahkan `import { json, urlencoded } from
'express'` untuk memasang batas ukuran body.

`express` bukan dependency langsung `@lms/api`. Ia transitif lewat
`@nestjs/platform-express`. Pada image produksi, layout `node_modules` pnpm
yang ketat membuat sebuah paket hanya dapat mengimpor apa yang tercantum di
`dependencies` miliknya sendiri. Modulnya tidak ditemukan, proses keluar
sebelum sempat mendengarkan port, dan health check-nya tidak pernah lulus.

## Contributing factors

- **Seluruh pemeriksaan lokal lulus.** Typecheck, ESLint, 87 unit test, 235
  e2e, dan `nest build` hijau. Di mesin pengembangan `node_modules` ter-hoist,
  jadi impornya terselesaikan. Tidak ada satu pun gerbang yang menjalankan
  hasil build pada layout produksi.
- **Impor lain di repo memakai `import type`,** yang hilang saat kompilasi.
  Pola yang terlihat sudah mapan itu menyamarkan bahwa impor nilai berbeda.
- **Perubahan besar dideploy sekaligus.** Sepuluh commit dan enam migrasi
  menumpuk sebelum deploy, sehingga permukaan kegagalannya luas.

## Detection gap

Ini temuan terpenting dari insiden ini.

**Saklar "container status change" milik Coolify tidak berfungsi.** Saklarnya
menyala di antarmuka dan bernilai `t` di database, tetapi pada Coolify 4.1.2
pemanggilan notifikasinya dikomentari di source:
`app/Actions/Docker/GetContainersStatus.php` baris 362 dan 450 berisi
`// $this->server->team?->notify(new ContainerStopped(...));`. Tidak ada satu
pun pemanggilan aktif untuk container aplikasi.

Surat yang datang hanya "Deployment failed" — dan itu pun hanya karena
kematiannya kebetulan terjadi di tengah proses deploy. **Container yang mati
di luar deploy tidak akan menghasilkan peringatan apa pun.**

Saklar itu sempat dinyatakan sebagai penutup lubang pemantauan container pada
hari yang sama. Pernyataan itu keliru, dan hanya terbukti keliru karena ada
kegagalan sungguhan.

Pemantauan galat aplikasi yang dibangun hari itu juga tidak dapat menolong:
API gagal *menyala*, sehingga tidak ada proses yang sempat mencatat apa pun.

## Response gap

- Deploy dipicu tanpa langkah verifikasi yang terdefinisi. Status `finished`
  dari Coolify sempat diperlakukan sebagai tanda berhasil, padahal ia hanya
  berarti `docker compose up` selesai.
- `DEPLOYMENT.md` §4 menggambarkan pipeline berbasis staging yang tidak ada,
  sehingga tidak dapat dipakai sebagai panduan saat kejadian.

## User impact

Situs tidak melayani ±9 menit. Tidak ada kehilangan data: jumlah baris setelah
deploy cocok persis dengan `MANIFEST.txt` backup pra-deploy — 4 pengguna,
4 enrollment, 5 order pendaftaran, 6 video. Tidak ada transaksi pembayaran
yang jatuh pada jendela itu.

## Data impact

Tidak ada. Lima migrasi terpasang seluruhnya dan bersifat aditif. Backfill
`announcements.notified_at` tidak mengubah baris apa pun karena tabelnya
kosong.

## Corrective action

| # | Tindakan | Status |
|---|---|---|
| 1 | Ganti impor express dengan `app.useBodyParser()` dari adapter Nest | Selesai — `13a20fe` |
| 2 | `scripts/health-watch.sh`: pengawas container tiap 5 menit lewat cron, menggantikan saklar Coolify yang mati | Selesai — `3dc8614`, diuji sampai inbox |
| 3 | `scripts/verify-deploy.sh`: gerbang verifikasi pasca-deploy | Selesai — diuji pada jalur gagal juga |
| 4 | `DEPLOYMENT.md` §4b: prosedur yang benar-benar dijalankan, bukan yang dicita-citakan | Selesai |
| 5 | `DEPLOYMENT.md` §4c: catatan jebakan impor transitif | Selesai |
| 6 | Deploy lebih sering supaya perubahan tidak menumpuk | Belum — kebiasaan, bukan perkakas |
| 7 | Gerbang CI yang menjalankan image produksi dan memastikan prosesnya mendengarkan | Selesai — job `boot`, diuji dengan mengembalikan bug aslinya |

## Yang masih terbuka

Tindakan 6 — deploy lebih sering supaya perubahan tidak menumpuk — adalah soal
kebiasaan, bukan perkakas, jadi tidak ada yang menegakkannya.

Tindakan 7 sudah dikerjakan sebagai job CI `boot`: membangun image API dan
worker lalu benar-benar menyalakannya. API diuji lewat `/health/live`, yang
sengaja tidak menyentuh dependency apa pun sehingga yang terbukti murni
"prosesnya menyala dan menerima koneksi". Worker diuji dengan memastikan ia
masih berjalan dan sudah mencetak penanda siap.

Gerbang itu diverifikasi dengan mengembalikan bug aslinya: image tetap
**berhasil dibangun** — membuktikan build memang tidak menangkap apa pun —
lalu containernya berhenti dengan `Cannot find module 'express'` dan gerbangnya
merah. Kode yang sudah diperbaiki menyala dalam 4 detik.

## Test atau alert baru

- `health-watch.sh` — peringatan container dan situs, diuji dengan memicu
  kondisinya: satu surat saat rusak, satu saat pulih, tidak ada surat kedua
  untuk kegagalan berulang.
- `verify-deploy.sh` — diuji pada dua jalur gagal: container hilang, dan
  migrasi repo yang belum terpasang di produksi.
