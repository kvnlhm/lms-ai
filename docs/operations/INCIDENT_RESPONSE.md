# Incident Response Plan

## 0. Bagaimana Insiden Diketahui

Peringatan otomatis dikirim lewat Resend ke alamat operator, dari
`alerts@send.aipreneur.co.id`.

| Sumber | Yang dilaporkan |
|---|---|
| Coolify | Deployment gagal, container berubah status, server tidak terjangkau, penggunaan disk, backup dan scheduled task gagal, docker cleanup gagal |
| `scripts/backup.sh` | Checkpoint backup gagal diambil |

Keberhasilan sengaja tidak dilaporkan, kecuali beberapa saklar Coolify yang
memang dimatikan secara default.

Dua hal yang belum terpantau dan masih menunggu pengerjaan:

- **Galat aplikasi.** Tidak ada pelaporan galat runtime API maupun web; galat
  hanya terlihat bila log dibaca manual.
- **Cron yang tidak pernah menyala.** Bila daemon cron mati, skrip backup tidak
  berjalan dan tidak ada yang mengirim peringatan. Sebagian tertutup oleh
  pemantauan server tidak terjangkau milik Coolify.

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
