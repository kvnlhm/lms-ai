# Security Controls

## 1. Identity and Authentication

| Control | Requirement | Verification |
|---|---|---|
| Password hashing | Argon2id atau secure equivalent | Unit/config test |
| Web session | Opaque ID di HttpOnly Secure cookie | Integration test |
| Session storage | Redis server-side | Integration test |
| Session rotation | Login, MFA, privilege change | Security test |
| CSRF | Wajib untuk mutation berbasis cookie | API test |
| MFA | Wajib untuk Master | E2E test |
| Login rate limit | Per IP dan account key | Abuse test |
| Password reset | Single-use, hashed, expiring | Integration test |
| Enumeration protection | Forgot-password response seragam | Security test |
| Session revoke | Current dan all devices | API test |

## 2. Authorization

- Default deny.
- Permission guard untuk capability.
- Resource policy untuk ownership dan enrollment.
- Scoped query untuk list.
- Bulk operation memvalidasi seluruh target.
- Sensitive action membutuhkan recent authentication.
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
