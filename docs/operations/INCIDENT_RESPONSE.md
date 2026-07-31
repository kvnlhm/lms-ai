# Incident Response Plan

## 0. Bagaimana Insiden Diketahui

Peringatan otomatis dikirim lewat Resend ke alamat operator, dari
`alerts@send.aipreneur.co.id`.

| Sumber | Yang dilaporkan |
|---|---|
| Coolify | Deployment gagal, server tidak terjangkau, penggunaan disk, backup dan scheduled task gagal, docker cleanup gagal |
| `scripts/health-watch.sh` | Container aplikasi mati atau unhealthy, dan situs tidak membalas 200 |
| `scripts/backup.sh` | Checkpoint backup gagal diambil |
| Pemantauan galat | Galat runtime baru pada API, browser, dan worker — lihat §0a |

Keberhasilan sengaja tidak dilaporkan, kecuali beberapa saklar Coolify yang
memang dimatikan secara default.

**Saklar "container status change" milik Coolify tidak berfungsi.** Saklarnya
ada di antarmuka dan dapat dinyalakan, tetapi pada Coolify 4.1.2 pemanggilan
notifikasinya dikomentari di dalam source:
`app/Actions/Docker/GetContainersStatus.php` baris 362 dan 450 berisi
`// $this->server->team?->notify(new ContainerStopped(...));`. Tidak ada satu
pun pemanggilan aktif untuk container aplikasi.

Ini ketahuan pada 31 Juli 2026 ketika produksi mati sembilan menit — API
crash-loop, container web dan gateway hilang — dan tidak satu pun surat
container terkirim. Yang datang hanya "Deployment failed", karena kebetulan
kematiannya terjadi di tengah deploy. Kegagalan di luar deploy tidak akan
menghasilkan apa pun.

`scripts/health-watch.sh` menutup lubang itu: berjalan tiap lima menit lewat
cron, memeriksa keenam layanan wajib beserta status `unhealthy`-nya, lalu
memanggil `/health/ready` dari luar karena seluruh container dapat terlihat
sehat sementara gateway salah merutekan. Surat hanya dikirim pada perpindahan
keadaan — sekali saat rusak, sekali saat pulih — supaya satu insiden tidak
menghasilkan puluhan surat.

Kunci Resend disalin ke `/var/lib/lms-health-watch/resend.key` setiap siklus
sehat. Tanpa itu, pengawas menjadi bisu tepat ketika seluruh container API mati
— kegagalan terparah yang justru paling perlu dilaporkan.

Satu hal yang masih belum terpantau:

- **Cron yang tidak pernah menyala.** Bila daemon cron mati, skrip backup tidak
  berjalan dan tidak ada yang mengirim peringatan. Sebagian tertutup oleh
  pemantauan server tidak terjangkau milik Coolify.

## 0a. Pemantauan Galat Aplikasi

Memenuhi PRD 12.7. Galat runtime tersimpan di tabel `error_events` dan dapat
dibuka Master pada `/master/errors`; permission `audit.read`.

| Sumber | Ditangkap di | Yang masuk |
|---|---|---|
| `API` | `AllExceptionsFilter` | Hanya respons 5xx |
| `WEB` | `global-error.tsx` dan `instrumentation.ts` | Galat render browser dan galat Server Component |
| `WORKER` | Event `failed` pada BullMQ | Job yang gagal setelah percobaan terakhir |

4xx sengaja tidak dicatat. Permintaan yang ditolak adalah sistem yang bekerja
sebagaimana mestinya; memasukkannya akan menenggelamkan kegagalan nyata di
antara ribuan percobaan login yang salah password.

**Pengelompokan.** Satu baris mewakili satu jenis galat, bukan satu kejadian.
Fingerprint dihitung dari sumber, kelas exception, pesan yang sudah dinormalkan
(UUID, angka, dan nilai dalam kutip diganti penanda), bingkai tumpukan pertama
milik kode sendiri, dan rute. Tanpa normalisasi, satu bug menghasilkan satu
baris — dan satu surat — per pengguna yang terkena.

**Kapan surat dikirim.** Hanya saat sebuah galat pertama kali muncul, atau
muncul lagi setelah ditandai selesai. Kejadian kedua dan seterusnya menambah
`occurrences` tanpa memberi tahu siapa pun. Ada pula anggaran
`ERROR_ALERT_MAX_PER_HOUR` (default 10) karena satu insiden dapat memunculkan
puluhan galat berbeda sekaligus.

**Menutup galat** bukan janji bahwa ia tidak akan kembali: bila fingerprint yang
sama muncul lagi, statusnya otomatis kembali `OPEN` dan satu surat dikirim.

**Batas yang perlu diketahui.** Endpoint `POST /telemetry/client-errors`
bersifat publik — galat pada halaman login dan pendaftaran justru yang paling
perlu diketahui, dan di sana belum ada sesi. Pagarnya berupa batas per IP
(`CLIENT_ERROR_MAX_PER_HOUR`, default 30), payload yang dibatasi ketat, serta
`source` dan waktu yang ditentukan server, bukan pelapor.

Catatan operasional: pengaturan notifikasi Coolify dibaca oleh proses antrean
yang berumur panjang. Setelah mengubahnya di luar UI, jalankan
`docker exec coolify php artisan horizon:terminate` agar worker memuat ulang;
tanpa itu pengiriman tetap memakai pengaturan lama dan gagal diam-diam.

---

## 1. Severity

| Severity | Contoh | Response |
|---|---|---|
| SEV-1 | Data breach, core LMS down, progress corruption | Immediate incident command |
| SEV-2 | Major feature unavailable, queue critical blocked | Urgent response |
| SEV-3 | Partial degradation, non-critical provider issue | Business-hours response |
| SEV-4 | Minor bug atau documentation issue | Normal backlog |

---

## 2. Roles

- Incident Commander: mengarahkan response.
- Technical Lead: diagnosis dan recovery.
- Communications Lead: update stakeholder.
- Security Lead: breach assessment.
- Scribe: timeline dan action log.

Satu orang dapat memegang beberapa role untuk tim kecil, tetapi Incident Commander harus jelas.

---

## 3. Response Flow

1. Detect.
2. Triage dan severity.
3. Declare incident.
4. Contain.
5. Preserve evidence.
6. Diagnose.
7. Recover.
8. Verify.
9. Communicate.
10. Post-incident review.

---

## 4. Immediate Actions

### Suspected Account Compromise

- Revoke affected sessions.
- Force password reset.
- Review audit log.
- Check privilege changes.
- Preserve request and security logs.

### Suspected Data Breach

- Restrict affected endpoint.
- Rotate relevant secrets.
- Preserve evidence.
- Identify affected data classes.
- Consult legal/privacy owner.
- Do not delete logs.

### Database Corruption

- Stop destructive writes if required.
- Snapshot current state.
- Identify last valid recovery point.
- Restore to isolated environment.
- Compare integrity before cutover.

### Queue Failure

- Pause affected queue if jobs are harmful.
- Keep core API available where safe.
- Inspect failed jobs and Redis health.
- Replay only idempotent jobs.

### Object Storage Exposure

- Revoke public policy.
- Rotate storage credential.
- Invalidate signed access where possible.
- Review access logs.
- Identify exposed assets.

---

## 5. Communication Template

```text
Incident:
Severity:
Started:
Current impact:
Affected users:
Actions taken:
Next decision:
Owner:
Next update:
```

Jangan menyatakan penyebab final sebelum evidence cukup.

---

## 6. Recovery Verification

- Health check hijau.
- Login berhasil.
- Enrollment access benar.
- Lesson completion berhasil.
- Progress konsisten.
- Queue berjalan.
- Error rate normal.
- Security control kembali aktif.
- Stakeholder menerima update.

---

## 7. Post-Incident Review

Dilakukan maksimal lima hari kerja setelah SEV-1/SEV-2.

Isi:

- Timeline.
- Root cause.
- Contributing factors.
- Detection gap.
- Response gap.
- User impact.
- Data impact.
- Corrective action.
- Owner.
- Due date.
- Test atau alert baru.

Review bersifat blameless dan berfokus pada sistem.
