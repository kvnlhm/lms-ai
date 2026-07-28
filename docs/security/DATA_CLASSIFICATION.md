# Data Classification

## Classification Levels

| Level | Nama | Contoh | Perlindungan |
|---|---|---|---|
| C0 | Public | Published course title, public landing content | Integrity control |
| C1 | Internal | System configuration non-secret, internal documentation | Authenticated staff access |
| C2 | Confidential | User profile, progress, forum report, analytics | Encryption, permission, audit |
| C3 | Restricted | Password hash, session, MFA secret, reset token, infrastructure secret | Strong encryption, least privilege, no logging |

## Data Inventory

| Data | Classification | Storage | Retention |
|---|---|---|---|
| Email dan phone | C2 | PostgreSQL | Account lifecycle + policy |
| Password hash | C3 | PostgreSQL | Sampai account deleted/anonymised |
| Session ID | C3 | Cookie/Redis | Session expiration |
| MFA secret | C3 | Encrypted PostgreSQL | Sampai revoked |
| Learning goal | C2 | PostgreSQL | Account lifecycle |
| Progress | C2 | PostgreSQL | Long-term learning history |
| Raw learning event | C2 | PostgreSQL/analytics store | Defined event retention |
| Forum content | C2 | PostgreSQL | Content policy |
| Published course content | C0/C1 | PostgreSQL/storage | Product lifecycle |
| Private course files | C2 | Object storage | Course lifecycle |
| Audit log | C2/C3 | PostgreSQL/log store | Security retention |
| Application logs | C1/C2 | Log platform | Short operational retention |
| Backup | Highest contained class | Backup storage | Backup policy |
| AI request payload | C1/C2 | Temporary/provider | Minimal duration |
| AI output | C1/C2 | Application storage | Feature-specific |

## Rules

- C3 tidak boleh ditulis ke log.
- C2 tidak boleh menjadi public metric label.
- Backup mengikuti classification tertinggi dari data di dalamnya.
- Export C2 harus diaudit.
- AI service hanya menerima field yang dibutuhkan.
- Development menggunakan synthetic atau anonymised data.
- Production dump tidak boleh digunakan di laptop developer tanpa approved process.
