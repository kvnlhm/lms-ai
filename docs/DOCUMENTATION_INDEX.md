# Documentation Index

## LMS Platform

Dokumen ini menjadi peta utama seluruh dokumentasi proyek.

## 1. Urutan Membaca

### Product dan Scope

1. `docs/PRD.md`
2. `docs/GLOSSARY.md`
3. `docs/roadmap/IMPLEMENTATION_ROADMAP.md`
4. `docs/roadmap/PRODUCT_BACKLOG.md`

### Architecture dan Data

1. `docs/architecture/ARCHITECTURE.md`
2. `docs/database/ERD.md`
3. `docs/api/API_CONTRACT.md`
4. `docs/analytics/EVENT_DICTIONARY.md`
5. `docs/decisions/`

### Security dan Operations

1. `docs/security/THREAT_MODEL.md`
2. `docs/security/SECURITY_CONTROLS.md`
3. `docs/security/ACCESS_CONTROL_MATRIX.md`
4. `docs/security/DATA_CLASSIFICATION.md`
5. `docs/operations/DEPLOYMENT.md`
6. `docs/operations/ENVIRONMENT_VARIABLES.md`
7. `docs/operations/BACKUP_RESTORE.md`
8. `docs/operations/INCIDENT_RESPONSE.md`

### Quality

1. `docs/testing/TEST_PLAN.md`
2. `docs/testing/DEFINITION_OF_DONE.md`

### Agent Instructions

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.claude/agents/`
4. `.codex/agents/`

---

## 2. Source of Truth

Apabila ada konflik, gunakan urutan berikut:

1. PRD untuk kebutuhan produk.
2. ADR berstatus `Accepted` untuk keputusan teknis.
3. Architecture untuk struktur sistem.
4. ERD untuk struktur data.
5. API Contract untuk interface.
6. Security Controls untuk batas keamanan.
7. Test Plan untuk verifikasi.
8. Roadmap dan backlog untuk urutan pengerjaan.

Dokumen dengan status `Superseded` tidak boleh digunakan sebagai dasar implementasi baru.

---

## 3. Status Dokumen

| Dokumen | Status | Tujuan |
|---|---|---|
| PRD | Approved Baseline | Scope dan requirement |
| Architecture | Approved Baseline | Struktur teknis |
| ERD | Approved Logical Design | Data model |
| API Contract | Approved Baseline | Interface REST |
| Event Dictionary | Approved Baseline | Analytics events |
| Threat Model | Approved Baseline | Risiko keamanan |
| Security Controls | Approved Baseline | Kontrol keamanan |
| Access Control Matrix | Approved Baseline | Role dan permission |
| Data Classification | Approved Baseline | Perlindungan data |
| Deployment | Approved Initial Topology | Deployment awal |
| Backup and Restore | Approved Baseline | Recovery |
| Incident Response | Approved Baseline | Penanganan insiden |
| Test Plan | Approved Baseline | Strategi testing |
| Definition of Done | Approved Baseline | Gate penyelesaian |
| Product Backlog | Initial Backlog | Task implementasi |
| ADR | Per ADR | Keputusan teknis |

---

## 4. Artefak Non-Markdown yang Dibutuhkan Saat Coding

Dokumen ini lengkap sebagai blueprint, tetapi implementasi tetap harus menghasilkan:

- `openapi.yaml` dari NestJS.
- `schema.prisma`.
- Database migration.
- Source code Next.js, NestJS, worker, dan FastAPI.
- Dockerfile dan Compose.
- CI workflow.
- Automated tests.
- Wireframe atau design file.

Artefak tersebut bukan kekurangan dokumentasi `.md`; artefak tersebut merupakan output fase implementasi.
