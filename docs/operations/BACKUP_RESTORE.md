# Backup and Restore

## 1. Objectives

Target awal:

- Database RPO: 15 menit.
- Core service RTO: 60 menit.
- Object metadata RPO: 24 jam atau provider versioning.
- Audit dan backup harus berada pada failure domain berbeda dari server utama.

Target dapat ditingkatkan berdasarkan business impact dan budget.

---

## 2. Backup Scope

- PostgreSQL.
- Object storage metadata dan versioning.
- Infrastructure configuration.
- Encrypted secret recovery procedure.
- OpenAPI, Prisma schema, dan migration melalui Git.
- Critical operational documentation.

Redis:

- Session dapat hilang dan pengguna login ulang.
- Queue perlu persistence sesuai konfigurasi.
- Core progress tidak bergantung pada Redis sebagai source of truth.

---

## 3. PostgreSQL Strategy

Production:

- Point-in-time recovery jika provider mendukung.
- Daily snapshot.
- Weekly retained snapshot.
- Monthly retained snapshot sesuai policy.
- Backup encrypted at rest dan in transit.

Retention baseline:

```text
PITR: 7–14 hari
Daily: 14 hari
Weekly: 8 minggu
Monthly: 12 bulan
```

Retention final disesuaikan compliance dan biaya.

---

## 4. Object Storage

- Private bucket.
- Versioning untuk material penting.
- Lifecycle rule.
- Soft-delete window bila provider mendukung.
- Report export memiliki expiry.
- Malware/quarantine object mengikuti policy terpisah.

### Self-hosted video (ADR-014)

- Persistent video volume termasuk backup scope.
- Backup harus encrypted dan berada di failure domain berbeda dari VPS.
- Database dan video volume diambil dalam checkpoint yang dapat direkonsiliasi
  menggunakan `video_asset_id` dan object key.
- Minimal satu asset acak direstore dan diputar pada setiap restore drill.
- Snapshot Hostinger pada VPS yang sama bukan satu-satunya salinan backup.

---

## 5. Restore Procedure

1. Deklarasikan incident dan freeze perubahan.
2. Tentukan recovery point.
3. Provision database recovery environment.
4. Restore snapshot dan WAL/PITR.
5. Jalankan integrity check.
6. Verifikasi migration version.
7. Jalankan smoke test read-only.
8. Reconnect staging copy jika perlu.
9. Cut over production.
10. Verify login, course access, progress, dan queue.
11. Dokumentasikan data loss window.
12. Buat post-incident review.

---

## 6. Restore Drill

Minimal setiap tiga bulan:

- Restore database ke isolated environment.
- Verifikasi jumlah row utama.
- Verifikasi random enrollment dan progress.
- Verifikasi file sample.
- Jalankan critical E2E flow.
- Catat actual RPO dan RTO.
- Tutup gap yang ditemukan.

Backup dianggap belum valid sampai berhasil direstore.

---

## 7. Ownership

| Area | Owner |
|---|---|
| Backup configuration | DevOps Engineer |
| Database integrity | Database Engineer |
| Restore validation | QA Engineer |
| Security review | Security Reviewer |
| Business approval | Engineering Manager/Product Owner |
