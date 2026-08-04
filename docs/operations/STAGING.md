# Staging

Salinan kedua aplikasi di alamat berbeda, dengan database sendiri. Gunanya satu:
tempat mencoba perubahan sebelum pelajar yang merasakannya. Tes membuktikan kode
berperilaku benar; staging tempat menjawab "apakah ini enak dipakai" — dan untuk
pertanyaan itu, produksi bukan tempat yang pantas.

## Yang sudah disiapkan di repo

- `APP_ENV` dapat disetel per lingkungan; bawaannya tetap `production`, sehingga
  tidak ada yang berubah bagi produksi.
- Salinan non-produksi menampilkan bilah merah di puncak setiap halaman dan
  mengirim `noindex`. Keduanya penting: staging yang tampak persis produksi akan
  membuat orang menghapus sesuatu di tempat yang salah, dan staging yang
  terindeks akan menarik pelajar sungguhan ke data uji.
- Konfigurasi **menolak boot** bila `APP_ENV` bukan `production` sementara
  `MIDTRANS_ENVIRONMENT=PRODUCTION`. Lihat alasannya di bawah.

## Dua langkah yang hanya dapat dilakukan manusia

### 1. Satu record DNS

DNS domain ini dikelola Hostinger (`ns1.dns-parking.com`), dan tidak ada
wildcard. Tambahkan satu record:

```
Tipe  Nama                Nilai
A     staging.academy     31.97.105.104
```

### 2. Salin aplikasi di Coolify

Coolify → aplikasi `e1b4fo52n9tnzjpm5m2i5k8l` → **Clone**. Salinan itu otomatis
mendapat volume dan database sendiri, jadi datanya terpisah sejak awal.

Sesudah menyalin, **wajib** ubah env berikut sebelum deploy pertama:

| Variabel | Nilai staging | Kalau lupa |
|---|---|---|
| `APP_ENV` | `staging` | Bilah penanda tidak muncul, halaman terindeks Google, dan penjaga Midtrans di bawah tidak menyala |
| `WEB_URL` | `https://staging.academy.aipreneur.co.id` | Tautan di email dan callback pembayaran menunjuk produksi |
| `MIDTRANS_ENVIRONMENT` | `SANDBOX` | **Aplikasi menolak menyala** — disengaja |
| `MIDTRANS_SERVER_KEY` / `CLIENT_KEY` | kunci sandbox | Checkout gagal, atau lebih buruk bila `APP_ENV` juga salah |
| `EMAIL_PROVIDER` | `DISABLED` | Email undangan sungguhan terkirim dari data uji |
| `WHATSAPP_PROVIDER` | `DISABLED` | WhatsApp sungguhan terkirim ke nomor sungguhan |
| `BUNNY_STREAM_*` | kosongkan | Staging ikut memakai kuota bandwidth produksi |

Domain aplikasinya disetel ke `staging.academy.aipreneur.co.id`; Coolify yang
mengurus sertifikatnya.

## Kenapa Midtrans menolak boot, bukan sekadar memperingatkan

Staging lahir sebagai salinan produksi, dan salinan itu membawa seluruh env-nya
— termasuk kunci Midtrans PRODUCTION. Akibatnya bukan sekadar data uji yang
kotor: checkout di staging akan benar-benar menagih kartu orang, dan webhook-nya
membuatkan akun di database staging sementara pembelinya menunggu akses di
produksi.

Aplikasi yang mati saat dinyalakan jauh lebih murah daripada aplikasi yang
menerima uang secara diam-diam. Karena itu penjaganya menolak, dan pesannya
menyebutkan `APP_ENV` yang sedang berlaku supaya penyebabnya langsung terbaca.

## Alur kerja sesudahnya

1. Dorong perubahan ke branch.
2. Deploy ke staging, coba sendiri.
3. Baru deploy ke produksi.

`scripts/verify-deploy.sh` sudah menerima `LMS_APP_UUID`, jadi verifikasi yang
sama dapat dijalankan pada staging dengan mengganti UUID-nya.

## Yang tidak ikut tersalin

Database staging kosong. Untuk mengisinya, jalankan seed, atau pulihkan salinan
backup produksi — dengan catatan backup itu memuat data pribadi pelajar
sungguhnya, jadi memulihkannya ke staging berarti menyalin data pribadi ke
lingkungan yang lebih longgar. Seed lebih aman.
