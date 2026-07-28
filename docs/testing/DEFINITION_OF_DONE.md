# Definition of Done

Sebuah task atau feature dianggap selesai hanya jika seluruh item relevan terpenuhi.

## Product

- Requirement mengacu pada PRD atau approved change.
- Acceptance criteria terpenuhi.
- Scope tambahan tidak disisipkan.
- Edge case utama terdokumentasi.

## Architecture

- Mengikuti module ownership.
- Tidak membuat circular dependency.
- ADR dibuat jika keputusan baru signifikan.
- API dan ERD diperbarui jika berubah.

## Backend

- Validation tersedia.
- Authorization tersedia.
- Transaction digunakan bila perlu.
- Outbox event tersedia bila ada asynchronous side effect.
- Idempotency tersedia untuk mutation kritis.
- Error code sesuai contract.
- No secret/PII leakage.

## Frontend

- Menggunakan generated API client.
- Loading, empty, error, success, forbidden, dan expired state tersedia.
- Responsive.
- Accessible label dan keyboard behaviour tersedia.
- Duplicate submission dicegah.

## Data

- Migration tersedia.
- Constraint dan index sesuai.
- Rollback atau expand-contract plan tersedia.
- Seed/factory diperbarui.
- Retention dipertimbangkan.

## Test

- Unit test.
- Integration/API test.
- Permission test.
- Regression test.
- Critical E2E diperbarui bila relevan.
- Test lulus pada CI.

## Security

- Threat baru ditinjau.
- File, export, auth, permission, atau AI mendapat security review.
- Tidak ada Critical finding.
- High finding memiliki resolution atau accepted mitigation.

## Operations

- Environment variable terdokumentasi.
- Logging dan metric tersedia.
- Health check tidak rusak.
- Deployment dan rollback dipahami.
- Feature flag memiliki owner dan expiry bila digunakan.

## Documentation

- README atau user guide diperbarui.
- Changelog diperbarui.
- API contract dan OpenAPI sinkron.
- Implementation report mencantumkan files, tests, risks, dan unresolved issues.
