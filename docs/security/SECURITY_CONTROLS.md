# Security Controls

## 1. Identity and Authentication

| Control | Requirement | Verification |
|---|---|---|
| Password hashing | Argon2id atau secure equivalent | Unit/config test |
| Web session | Opaque ID di HttpOnly Secure cookie | Integration test |
| Session storage | Redis server-side | Integration test |
| Session rotation | Login, MFA, privilege change | Security test |
| CSRF | Wajib untuk mutation berbasis cookie | API test |
| MFA | Wajib untuk Master secara default; pengecualian deployment harus dicatat melalui ADR-020 | E2E test dan configuration review |
| Client IP resolution | `trust proxy = 2`, sesuai rantai Traefik lalu gateway nginx; Traefik menimpa `X-Forwarded-For` klien sehingga hop tidak dapat digeser | Manual: header palsu tetap tercatat sebagai alamat asli |
| Login rate limit | Per IP dan account key | Abuse test |
| Password reset rate limit | Per alamat dan per IP; setiap permintaan dihitung, bukan hanya yang gagal | `forgot-password.e2e-spec.ts` |
| Password reset | Single-use, hashed, expiring | Integration test |
| Enumeration protection | Forgot-password membalas seragam, dan pengiriman email tidak ditunggu agar waktu balasan tidak membocorkan | `forgot-password.e2e-spec.ts` |
| Session revoke | Current dan all devices | API test |

## 2. Authorization

- Default deny.
- Permission guard untuk capability.
- Resource policy untuk ownership dan enrollment.
- Scoped query untuk list.
- Bulk operation memvalidasi seluruh target.
- Sensitive action membutuhkan recent authentication.
- Pencarian global menyempitkan setiap kueri menurut permission pemanggil; lihat
  `API_CONTRACT.md` §42.
- Audit log hanya dapat dibaca pemegang `audit.read`; isinya memuat cuplikan
  data sebelum/sesudah dan alamat IP, sehingga bukan konsumsi umum.
- Audit log tidak memiliki endpoint ubah maupun hapus.
- Permission tidak pernah berasal dari client payload.
- Master role tidak otomatis berarti seluruh permission apabila permission model dikembangkan lebih granular.

## 3. Input and Output

- DTO allow-list.
- Runtime validation.
- Maximum request size.
- Sanitisation forum content.
- Output encoding.
- CSP.
- Parameterised database query.
- Sort dan filter field allow-list.
- Safe JSON serialization.
- Error tidak menyertakan stack trace pada production.

## 4. File Security

- Private bucket.
- Direct upload signed URL.
- MIME allow-list.
- Extension validation.
- Size limit per purpose.
- Random object key.
- Malware scan.
- Image re-encoding bila relevan.
- Signed download URL.
- Short expiration.
- Content-Disposition.
- Lifecycle deletion.
- Quarantine sampai status `AVAILABLE`.

## 4a. Error Reporting

| Control | Requirement | Verification |
|---|---|---|
| Endpoint laporan browser | Publik tanpa sesi, karena galat halaman login perlu terlihat | `error-monitoring.e2e-spec.ts` |
| Batas laju laporan | Per IP per jam, agar tabel galat tidak dapat digelembungkan | `error-monitoring.e2e-spec.ts` |
| Batas payload | `type`, `message`, `stack`, `path` dibatasi; field lain ditolak | `error-monitoring.e2e-spec.ts` |
| Sumber tidak dipercaya | `source` dan waktu ditentukan server, bukan pelapor | `error-monitoring.e2e-spec.ts` |
| Akses pembacaan | `audit.read`; pelajar ditolak `403` | `error-monitoring.e2e-spec.ts` |
| PII pada galat | `context` hanya pengenal teknis, tanpa email, nama, atau payload | Review kode |
| Anggaran peringatan | Batas surat per jam agar insiden besar tidak membanjiri kotak masuk | `error-monitor.service.spec.ts` |

## 4b. Report Export

| Control | Requirement | Verification |
|---|---|---|
| Akses ekspor | `reports.export`; pelajar ditolak `403` | `reports.e2e-spec.ts` |
| Injeksi rumus CSV | Sel teks berawalan `=`, `+`, `-`, `@`, tab dinetralkan | `csv.spec.ts`, `reports.e2e-spec.ts` |
| Kredensial pada ekspor | Password hash, rahasia MFA, dan token tidak pernah diambil | `reports.e2e-spec.ts` |
| Caching | `Cache-Control: no-store` pada seluruh berkas laporan | `reports.e2e-spec.ts` |
| Batas ukuran | Lebih dari 50.000 baris ditolak, bukan dipotong diam-diam | Review kode |
| Jejak ekspor | Tercatat sebagai `report.exported`, tanpa menyalin isi laporan | `reports.e2e-spec.ts` |
| Nama berkas | Kunci laporan dibersihkan sebelum masuk `Content-Disposition` | `csv.spec.ts` |

## 5. API Security

- HTTPS only.
- CORS allow-list.
- CSRF untuk cookie auth.
- Request ID.
- Idempotency pada operation kritis.
- Rate limiting.
- API version.
- Consistent error.
- OpenAPI contract test.
- No secret in response.

## 5a. Rate Limiting dan Batas Permintaan

| Control | Requirement | Verification |
|---|---|---|
| Pembatas laju global | Berlaku untuk seluruh endpoint, per alamat, default 240/menit | `rate-limit.e2e-spec.ts` |
| Urutan guard | Pembatas berjalan **sebelum** pemeriksaan sesi | `rate-limit.e2e-spec.ts` |
| Anggaran endpoint mahal | Pencarian 60/menit, unduhan laporan 20/menit, terpisah dari anggaran umum | `rate-limit.e2e-spec.ts` |
| Pembebasan | Hanya health check, yang dipolling mesin | `rate-limit.e2e-spec.ts` |
| Alamat pada Redis | Di-hash sebelum menjadi key | Review kode |
| Batas ukuran body | `MAX_REQUEST_BODY_BYTES`, default 256 KiB | Review kode |

Pembatas per-alur yang sudah ada — login, pemulihan password, checkout, laporan
galat browser — tetap dipertahankan. Yang global adalah pagar kasar terhadap
banjir; yang per-alur jauh lebih ketat dan punya makna sendiri.

**Perilaku saat Redis mati:** pembatas dilewati, permintaan tetap dilayani, dan
kegagalannya dicatat. Ini pilihan sadar — kehilangan pembatas laju sesaat lebih
ringan daripada seluruh akademi berhenti melayani karena satu dependensi.

## 5b. Gerbang CI

`SECURITY_CONTROLS.md` §11 sudah lama mewajibkan dependency scan dan secret
scan; keduanya baru benar-benar berjalan sejak 31 Juli 2026.

| Gerbang | Perilaku |
|---|---|
| Dependency scan produksi | **Memblokir** pada high/critical |
| Dependency scan penuh | Hanya laporan; temuan pada perkakas build tidak menghentikan rilis |
| Secret scan | Memblokir; memakai riwayat penuh agar rahasia yang sempat ditambahkan lalu dihapus tetap terlihat |
| Drift migrasi | Memblokir bila `schema.prisma` dan migrasi tidak sepakat |

Saat gerbang ini dipasang ada 15 advisory high, 9 di antaranya menyentuh
produksi (`js-yaml`, `lodash`, `multer` ×4, `postcss` ×2, `sharp`). Seluruhnya
transitif dan diperbaiki lewat `pnpm.overrides`. Sisanya ada pada rantai
perkakas build.

## 6. Database Security

- PostgreSQL private network.
- TLS.
- Application role terpisah dari migration role.
- Least privilege.
- Backup encrypted.
- Foreign key dan constraint.
- Audit privileged query melalui application flow.
- Production database tidak digunakan untuk development.
- PII tidak dimasukkan ke metric label.

## 7. Redis Security

- Private network.
- Authentication dan TLS jika tersedia.
- Prefix terpisah untuk session, cache, queue.
- No public port.
- Restricted administrative commands.
- Backup/persistence disesuaikan workload.
- Session eviction policy tidak boleh sama dengan volatile cache jika instance dipisah.

## 8. Worker Security

- Job payload minimum.
- Job tidak menyimpan credential.
- Job memiliki event ID.
- Consumer idempotent.
- Retry terbatas.
- Dead-letter review.
- AI dan external provider call memiliki timeout.
- Worker menggunakan service account terpisah bila infrastructure mendukung.

## 9. AI Security

- Data minimisation.
- Explicit schema input/output.
- Model dan prompt version.
- Output dianggap untrusted.
- AI tidak memiliki authority atas permission, progress, completion, payment, atau account status.
- Tool access menggunakan allow-list.
- Sensitive data redaction.
- Evaluation sebelum rollout.
- Cost dan rate limit.
- Human override untuk keputusan berdampak tinggi.

## 10. Infrastructure Security

- Secret manager atau protected environment.
- No secret dalam Git.
- Container non-root jika memungkinkan.
- Minimal base image.
- Image scan.
- Dependency scan.
- WAF/CDN.
- Firewall.
- SSH key only.
- Named administrative account.
- Patch schedule.
- Centralised logging.
- Alert untuk auth anomaly dan backup failure.
- Galat runtime tercatat dan diberitahukan; lihat `INCIDENT_RESPONSE.md` §0a.

## 11. Secure Development Gate

Setiap pull request critical wajib melewati:

- Lint.
- Type check.
- Unit test.
- Integration test.
- Authorization test.
- Dependency scan.
- Secret scan.
- Migration review.
- Security reviewer untuk auth, permission, export, upload, atau AI.

## 12. Bunny Stream Video Security

- Bunny Stream menjadi provider video utama.
- Bunny API key hanya tersedia pada NestJS backend dan authorised worker.
- MediaCage Basic DRM aktif untuk protected video.
- Token Authentication dan Allowed Domains wajib aktif.
- Playback URL memiliki expiration singkat.
- Playback dibuat hanya setelah enrollment validation.
- Permanent public playback URL tidak disimpan.

## 13. Self-hosted Video Security

Saat `VIDEO_PROVIDER=SELF_HOSTED` sesuai ADR-014:

- Video berada pada volume private di luar web root.
- Object key acak; nama file asli hanya menjadi metadata yang disanitasi.
- Upload memerlukan `courses.manage`, CSRF, MIME/extension/magic-byte check,
  size limit, dan rate limit.
- Playback memerlukan validasi enrollment dan lesson access di backend.
- Reverse proxy hanya membaca volume dan hanya melalui internal location.
- URL atau playback session berumur singkat dan tidak dicatat pada log.
- Tidak ada klaim DRM atau anti-download.
- Backup video terenkripsi disimpan di luar failure domain VPS.
- Playback token tidak dicatat pada log.
- Webhook diverifikasi dan replay-protected.
- Sesuai ADR-027, player tidak menampilkan nama, email, atau kode sesi sebagai watermark.
- Pemutar menyembunyikan kontrol unduh, picture-in-picture, dan remote playback yang didukung browser.
- Concurrent playback dapat dibatasi melalui playback session.
- Account suspension dan enrollment expiry memblokir session baru.
- Video tidak melewati bandwidth NestJS.
- Signed playback dan kontrol browser mengurangi pengunduhan kasual, tetapi tidak dapat mencegah
  pengguna terautentikasi menangkap traffic, memakai screen recorder OS, atau merekam dengan perangkat eksternal.
