# Access Control Matrix

## Roles

- `MASTER`
- `STUDENT`

Role bukan satu-satunya kontrol. Backend tetap memeriksa resource ownership, enrollment, account status, dan permission.

## Permission Matrix

| Capability | Master | Student | Additional Rule |
|---|---:|---:|---|
| Login | Yes | Yes | Account active |
| View own profile | Yes | Yes | Own account |
| Update own profile | Yes | Yes | Cannot update role/status |
| Manage users | Yes | No | `users.manage` |
| View all users | Yes | No | `users.read` |
| View own courses | Yes | Yes | Student requires enrollment |
| Manage courses | Yes | No | `courses.manage` |
| Publish course | Yes | No | Valid content required |
| Manage enrollment | Yes | No | `enrollments.manage` |
| View own progress | Yes | Yes | Own enrollment |
| View another user progress | Yes | No | `analytics.read` or `users.read` |
| Complete lesson | No | Yes | Active enrollment and lesson access |
| Create discussion | Yes | Yes | Student requires course access |
| Edit own discussion | Yes | Yes | Discussion not locked |
| Edit others' discussion | Moderator | No | `discussions.moderate` |
| Moderate discussion | Yes | No | `discussions.moderate` |
| View analytics | Yes | No | `analytics.read` |
| Export reports | Yes | No | `reports.export` |
| View audit logs | Yes | No | `audit.read` |
| Manage role/permission | Restricted Master | No | `roles.manage` + recent auth |
| Upload course material | Yes | No | `courses.manage` |
| Download course material | Yes | Yes | Student requires active access |
| Create announcement | Yes | No | `announcements.manage` |
| View notification | Yes | Yes | Own notification |
| Revoke own session | Yes | Yes | Own session |
| Revoke other user session | Restricted Master | No | `users.security.manage` |
| Preview as another user | Restricted Master | No | `users.security.manage`, active Student only, read-only, audited |
| Delete user | Yes | No | `users.manage`, Student only, personal data redacted, audited |
| Manage access tiers | Yes | No | `commerce.manage` |
| View registration payment records | Yes | No | `commerce.manage` |
| Start public checkout | Public | Public | Active tier, server-side price |
| Process payment webhook | Provider only | No | Valid signature + provider status verification |

## Resource Rules

### Course

Student dapat melihat jika:

- Course `PUBLISHED`.
- Enrollment aktif.
- Access period valid.

Preview lesson dapat dibuka tanpa enrollment hanya jika product rule mengizinkan dan lesson `isPreview = true`.

### Discussion

Student dapat mengakses jika memiliki course access. Owner dapat mengedit selama:

- Discussion belum locked.
- Discussion belum hidden.
- Edit masih diizinkan oleh business rule.

### Analytics

- Data agregat tetap dianggap confidential.
- Detail pengguna hanya untuk Master dengan permission.
- Export memerlukan permission terpisah.

### Files

Signed URL hanya dibuat setelah resource authorization. Mengetahui `assetId` tidak memberikan hak akses.

## Denial Behaviour

- Gunakan `401` jika tidak authenticated.
- Gunakan `403` jika resource diketahui tetapi permission tidak ada.
- Gunakan `404` jika keberadaan resource tidak boleh diketahui.
