# Threat Model

## LMS Platform

| Informasi | Detail |
|---|---|
| Status | Approved Baseline |
| Method | STRIDE-inspired threat analysis |
| Scope | Web, API, Worker, AI Service, PostgreSQL, Redis, Storage |
| Review Trigger | Perubahan auth, role, payment, multi-tenant, AI data, atau file handling |

---

## 1. Assets

Aset yang harus dilindungi:

- Credential dan session.
- Profil pengguna.
- Learning progress.
- Course material privat.
- Forum content.
- Analytics dan behavioural data.
- Audit log.
- Export report.
- Object storage.
- Infrastructure secret.
- AI prompt, model output, dan evaluation data.

---

## 2. Trust Boundaries

```text
Internet
  ↓
CDN/WAF
  ↓
Next.js Web
  ↓
NestJS API
  ├── PostgreSQL
  ├── Redis
  ├── Object Storage
  └── BullMQ Workers
          ↓
      FastAPI AI Service / External Providers
```

Setiap perpindahan boundary wajib menggunakan authenticated dan authorised contract.

---

## 3. Threat Actors

- Pengguna anonim.
- Pelajar dengan akun valid.
- Master dengan permission terbatas.
- Account yang diambil alih.
- Malicious uploader.
- Automated bot.
- Compromised external provider.
- Insider dengan akses infrastructure.
- AI prompt injection atau malicious content.

---

## 4. Threat Register

| ID | Threat | Scenario | Impact | Control Utama | Risk |
|---|---|---|---|---|---|
| T-01 | Credential stuffing | Bot mencoba password bocor | Account takeover | Rate limit, MFA Master, monitoring | High |
| T-02 | Session theft | Cookie dicuri melalui device atau XSS | Account takeover | HttpOnly cookie, CSP, rotation, revocation | High |
| T-03 | CSRF | Situs lain mengirim mutation | Data berubah tanpa izin | CSRF token, SameSite cookie | High |
| T-04 | IDOR progress | Student mengganti user ID | Data pengguna lain terbuka | Scoped query, policy, security tests | Critical |
| T-05 | Course access bypass | Student membuka lesson tanpa enrollment | Kebocoran materi | Enrollment guard, signed access | High |
| T-06 | Privilege escalation | Field role dimasukkan ke update profile | Menjadi Master | DTO allow-list, permission policy | Critical |
| T-07 | Stored XSS | Script disimpan di forum | Session abuse dan defacement | Sanitisation, output encoding, CSP | High |
| T-08 | Malicious upload | File executable atau malware | User compromise | MIME allow-list, scan, private storage | High |
| T-09 | Signed URL sharing | URL materi dibagikan | Kebocoran konten | Short TTL, auth check, provider controls | Medium |
| T-10 | SQL injection | Filter atau raw query dimanipulasi | Data breach | Prisma, parameterised SQL, allow-list sort | Critical |
| T-11 | CSV injection | Isi export diawali formula | Eksekusi pada spreadsheet | Escape dangerous cell prefix | High |
| T-12 | Queue replay | Job diproses dua kali | Notification atau metric ganda | Event ID, idempotent consumer | Medium |
| T-13 | Outbox loss | Business data commit tanpa event | Analytics tidak sinkron | Transactional outbox | High |
| T-14 | Redis exposure | Redis terbuka ke internet | Session dan queue compromise | Private network, auth, TLS | Critical |
| T-15 | Backup exposure | Backup tidak terenkripsi | Full data breach | Encryption, restricted bucket | Critical |
| T-16 | Log leakage | Token atau PII ditulis ke log | Data exposure | Logging allow-list, redaction | High |
| T-17 | Analytics overexposure | Master melihat data di luar izin | Privacy breach | Permission, scoped aggregation | High |
| T-18 | AI data leakage | Data sensitif dikirim ke model | Privacy breach | Data minimisation, provider policy | High |
| T-19 | Prompt injection | Course/forum content memengaruhi agent | Unsafe output/action | Output validation, no autonomous authority | Medium |
| T-20 | Dependency compromise | Package malicious | Supply-chain attack | Lockfile, scan, review, pinning | High |
| T-21 | Denial of service | Report/upload request membebani sistem | Downtime | Rate limit, queue, size limit | High |
| T-22 | Audit tampering | Privileged actor menghapus audit | Hilangnya evidence | Append-only behaviour, restricted role | High |

---

## 5. Abuse Cases

### Student Mencoba Membaca Progress Student Lain

Expected control:

- Endpoint tidak menerima arbitrary user ID untuk self-service.
- Admin endpoint memerlukan `users.read`.
- Query dibatasi oleh current principal.
- Security test mencoba UUID valid milik pengguna lain.

### Student Membuka File Course Tanpa Enrollment

Expected control:

- API memvalidasi enrollment saat membuat signed URL.
- URL memiliki TTL pendek.
- Storage private.
- File metadata bukan bukti akses.

### Master Menambahkan Permission Sendiri

Expected control:

- Role dan permission change memerlukan permission khusus.
- Recent authentication.
- Audit log.
- Agent frontend tidak menampilkan action tanpa permission, tetapi backend tetap memverifikasi.

### User Mengunggah File Berbahaya

Expected control:

- Upload intent memvalidasi purpose.
- Object masuk quarantine.
- Malware scan.
- File hanya available setelah approved.
- Browser mendapat safe content headers.

---

## 6. Security Review Gate

Feature tidak dapat release apabila:

- Ada Critical finding terbuka.
- High finding tanpa accepted mitigation.
- Endpoint protected belum memiliki authorization test.
- File atau export belum memiliki security test.
- Secret ditemukan di repository.
- Dependency scan menemukan exploitable critical vulnerability.
