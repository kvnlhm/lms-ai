# REST API Contract

## Registration Commerce Extension

Public:

- `GET /api/v1/registration/tiers`
- `POST /api/v1/registration/checkout`
- `GET /api/v1/registration/orders/{orderCode}`
- `POST /api/v1/webhooks/midtrans`

Master (`commerce.manage`):

- `GET /api/v1/admin/access-tiers`
- `POST /api/v1/admin/access-tiers`
- `PATCH /api/v1/admin/access-tiers/{tierId}`

Harga dan kursus selalu diambil ulang dari database; client tidak dapat
menentukan nominal. Webhook wajib lolos signature dan status verification
provider sebelum provisioning.

## LMS API v1

| Informasi | Detail |
|---|---|
| Base Path | `/api/v1` |
| Protocol | HTTPS |
| Format | JSON |
| Authentication | Redis-backed opaque session melalui HttpOnly Secure cookie |
| API Documentation | OpenAPI |
| Pagination | Cursor untuk activity; page-based untuk management list |
| Time Format | ISO 8601 UTC |
| Identifier | UUID |
| Version | v1 |

---

## 1. Contract Principles

- Backend menjadi sumber kebenaran.
- Semua endpoint protected menjalankan authorization.
- Semua payload divalidasi.
- Response tidak mengekspos password, token hash, internal error, atau private metadata.
- Endpoint mutation mendukung idempotency ketika dibutuhkan.
- Breaking change membutuhkan API version baru atau masa deprecation.
- Error memiliki machine-readable code.
- List endpoint memiliki pagination dan filter yang jelas.
- API client TypeScript dihasilkan dari OpenAPI.

---

## 2. Standard Response

### Success Object

```json
{
  "data": {},
  "meta": {
    "requestId": "018f..."
  }
}
```

### Success List

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 125,
    "totalPages": 7,
    "requestId": "018f..."
  }
}
```

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data yang diberikan tidak valid.",
    "fields": {
      "email": ["Format email tidak valid."]
    },
    "requestId": "018f..."
  }
}
```

---

## 3. Standard Status Codes

| Status | Penggunaan |
|---|---|
| 200 | Read atau update berhasil |
| 201 | Resource berhasil dibuat |
| 202 | Job asynchronous diterima |
| 204 | Berhasil tanpa body |
| 400 | Request malformed atau business input invalid |
| 401 | Belum terautentikasi |
| 403 | Tidak memiliki izin |
| 404 | Resource tidak ditemukan atau tidak boleh diketahui |
| 409 | Conflict atau duplicate state |
| 422 | Field validation error |
| 429 | Rate limit |
| 500 | Internal error |
| 503 | Dependency kritis unavailable |

---

## 4. Common Error Codes

```text
AUTHENTICATION_REQUIRED
INVALID_CREDENTIALS
ACCOUNT_INACTIVE
ACCOUNT_SUSPENDED
MFA_REQUIRED
TOKEN_EXPIRED
PERMISSION_DENIED
RESOURCE_NOT_FOUND
VALIDATION_ERROR
EMAIL_ALREADY_USED
ENROLLMENT_ALREADY_EXISTS
ENROLLMENT_INACTIVE
COURSE_NOT_PUBLISHED
LESSON_LOCKED
LESSON_ALREADY_COMPLETED
IDEMPOTENCY_CONFLICT
DISCUSSION_LOCKED
FILE_NOT_AVAILABLE
REPORT_NOT_READY
RATE_LIMITED
INTERNAL_ERROR
```

---

## 5. Authentication

## POST `/auth/login`

Public.

Request:

```json
{
  "email": "student@example.com",
  "password": "string",
  "deviceName": "Chrome on Mac"
}
```

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "Student Name",
      "email": "student@example.com",
      "role": "STUDENT",
      "status": "ACTIVE",
      "requiresMfa": false
    }
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Rules:

- Rate limited.
- Session rotated after success.
- Suspended user rejected.
- Master may receive MFA challenge.

## POST `/auth/mfa/verify`

Authenticated pending MFA.

```json
{
  "challengeId": "uuid",
  "code": "123456"
}
```

## POST `/auth/session/rotate`

Merotasi session setelah perubahan privilege, MFA, atau re-authentication. Session identifier tidak pernah dikembalikan dalam response body.

Web MVP tidak menggunakan refresh token JWT. Session disimpan server-side pada Redis dan diidentifikasi melalui cookie opaque.

## POST `/auth/logout`

Revokes current session.

## POST `/auth/logout-all`

Revokes all sessions owned by the current user.

## GET `/auth/me`

Returns current user and effective permissions.

## POST `/auth/forgot-password`

Public and rate limited.

```json
{
  "email": "student@example.com"
}
```

Response must not reveal whether email exists.

```json
{
  "data": { "requested": true }
}
```

Balasan di atas berlaku untuk alamat terdaftar maupun tidak. Yang membedakan
hanya `422` untuk alamat yang bukan email dan `429` saat pembatas laju kena.

Pembatasnya dua lapis dalam satu jendela `AUTH_RATE_LIMIT_WINDOW_SECONDS`:
per alamat sebesar `AUTH_RATE_LIMIT_MAX`, dan per IP tiga kali lipatnya.
Lapis alamat mencegah satu kotak masuk dibanjiri walau penyerang berganti IP;
lapis IP mencegah satu sumber memindai banyak alamat.

Pengiriman email tidak ditunggu sebelum membalas. Lama panggilan ke provider
berbeda jelas dari cabang "akun tidak ada", dan selisih waktu itu sendiri
sudah cukup untuk menebak alamat mana yang terdaftar.

Hanya akun berstatus `ACTIVE` yang menerima tautan. Akun `SUSPENDED` dan
`INACTIVE` tidak, tanpa perbedaan apa pun pada balasan.

Endpoint administratif `POST /admin/users/{userId}/password-reset-link` tetap
ada dan tidak berubah: Master masih dapat menerbitkan tautan secara manual
untuk kasus dukungan, dan endpoint itu tidak mengirim email.

## POST `/auth/reset-password`

```json
{
  "token": "single-use-token",
  "password": "new-password",
  "passwordConfirmation": "new-password"
}
```

## POST `/auth/accept-invitation`

Public. Token bersifat sekali pakai, disimpan sebagai hash, dan berlaku tujuh hari.

```json
{
  "token": "single-use-token",
  "password": "new-password",
  "passwordConfirmation": "new-password"
}
```

Pada fase sebelum provider email tersedia, `POST /admin/users` mengembalikan
token undangan satu kali kepada Master agar tautan dapat disampaikan secara
manual. Token tidak boleh dicatat ke audit log maupun application log.

## GET `/auth/sessions`

Returns active devices for current user.

## DELETE `/auth/sessions/{sessionId}`

Revokes owned session.

---

## 6. Current User Profile

## GET `/auth/me`

Returns the current user profile and effective permissions.

## PATCH `/auth/me`

```json
{
  "fullName": "Freddie",
  "phone": "+62...",
  "bio": "Membangun bisnis dengan AI."
}
```

Only `fullName`, `phone`, and `bio` are accepted. Email, role, status, and
permissions cannot be changed through this endpoint.

## PUT `/auth/me/avatar`

Uploads a raw JPEG, PNG, or WebP body. Maximum size defaults to 5 MiB.
The API validates both the declared content type and file signature.

## DELETE `/auth/me/avatar`

Removes the current profile photo.

## GET `/auth/avatars/{filename}`

Returns an immutable public profile photo. Filenames are generated randomly
by the server and cannot be selected by the client.

## PUT `/me/learning-profile`

```json
{
  "primaryGoal": "AI_FOR_BUSINESS",
  "experienceLevel": "BEGINNER",
  "occupation": "Business Owner",
  "targetRole": null,
  "weeklyMinutes": 240,
  "targetSkills": [
    "AI automation",
    "AI marketing"
  ],
  "preferredLearningPathId": "uuid"
}
```

Allowed `primaryGoal`:

```text
AI_FOR_BUSINESS
AI_FOR_MARKETING
LEARN_CODING
LEARN_AI
AI_JOB_READINESS
```

## PATCH `/auth/me/password`

Requires the old password. A successful change revokes all active sessions.

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password",
  "newPasswordConfirmation": "new-password"
}
```

## GET `/me/notifications/preferences`

Returns the current user's preferences. Users without a stored row receive
secure defaults with all relevant in-app notifications enabled.

## PUT `/me/notifications/preferences`

```json
{
  "announcementsEnabled": true,
  "courseUpdatesEnabled": true,
  "learningRemindersEnabled": false
}
```

The payload is a full replacement and only affects the authenticated user.

---

## 7. Master User Management

Requires `users.read` or `users.manage`.

## GET `/admin/users`

Query:

```text
page
pageSize
search
status
role
primaryGoal
courseId
riskLevel
lastActivityFrom
lastActivityTo
sort
```

## POST `/admin/users`

```json
{
  "fullName": "Student Name",
  "email": "student@example.com",
  "phone": null,
  "role": "STUDENT",
  "status": "ACTIVE",
  "sendInvitation": true
}
```

Response pembuatan memuat profil pengguna, `invitationToken`, dan
`invitationExpiresAt`. Nilai token mentah hanya dikembalikan sekali.

## GET `/admin/users/{userId}`

Includes:

- Profile.
- Learning goal.
- Enrollments.
- Progress summary.
- Last activity.
- Risk summary.
- Discussion activity.

## PATCH `/admin/users/{userId}`

## POST `/admin/users/{userId}/suspend`

```json
{
  "reason": "Policy violation"
}
```

## POST `/admin/users/{userId}/activate`

## POST `/admin/users/{userId}/reset-mfa`

Master action requiring elevated permission and audit.

## POST `/admin/users/{userId}/password-reset-link`

Requires `users.security.manage`. Mengembalikan `token` dan `expiresAt` satu
kali untuk disampaikan Master secara manual. Penerbitan dicatat ke audit log
tanpa nilai token.

## DELETE `/admin/users/{userId}`

Requires `users.manage`. Hanya akun Pelajar. Seluruh sesi dicabut, data pribadi
diredaksi, dan relasi histori belajar tetap dipertahankan. Aksi diaudit.

## POST `/admin/users/{userId}/impersonate`

Requires `users.security.manage`. Membuat sesi pratinjau hanya-baca maksimal 30
menit untuk akun Pelajar aktif. Sesi memakai permission Pelajar; password dan
session target tidak pernah diberikan kepada Master. Aksi diaudit.

## POST `/admin/users/impersonation/end`

Hanya dapat dipanggil dari sesi pratinjau. Mencabut sesi pratinjau dan
memulihkan opaque session Master semula bila masih valid.

---

## 8. Learning Paths

## GET `/learning-paths`

Pelajar hanya melihat published path.

Query:

```text
audienceType
search
```

## GET `/learning-paths/{learningPathId}`

Includes ordered courses and completion summary for current user.

## POST `/admin/learning-paths`

Requires `courses.manage`.

## PATCH `/admin/learning-paths/{learningPathId}`

## POST `/admin/learning-paths/{learningPathId}/publish`

## POST `/admin/learning-paths/{learningPathId}/archive`

## PUT `/admin/learning-paths/{learningPathId}/courses`

```json
{
  "courses": [
    {
      "courseId": "uuid",
      "position": 1,
      "isRequired": true
    }
  ]
}
```

---

## 9. Courses

## GET `/courses`

Returns published and accessible catalogue according to user context.

Query:

```text
page
pageSize
search
category
level
learningPathId
```

## GET `/courses/{courseId}`

For Pelajar:

- Requires active enrollment or preview access.
- Includes current progress.

For Master:

- Includes management metadata when permission exists.

## GET `/admin/courses`

Includes draft, published, and archived.

## GET `/admin/course-categories`

Returns the Master-selectable course categories. Initial production categories:

- AI untuk Pemilik Bisnis
- AI untuk Marketing
- Dasar Coding
- Fundamental dan Penerapan AI
- Karier dan Kesiapan Kerja AI

## POST `/admin/courses`

```json
{
  "title": "AI for Business",
  "slug": "ai-for-business",
  "categoryId": "uuid",
  "shortDescription": "string",
  "description": "string",
  "level": "BEGINNER",
  "estimatedMinutes": 600,
  "thumbnailAssetId": "uuid"
}
```

## PATCH `/admin/courses/{courseId}`

## PUT `/admin/courses/{courseId}/thumbnail`

- Permission: `courses.manage`.
- Raw body dengan Content-Type `image/jpeg`, `image/png`, atau `image/webp`.
- Batas default 5 MiB dan signature file diverifikasi server.
- Mengganti thumbnail lama secara atomik dan mengembalikan `thumbnailUrl`.

## DELETE `/admin/courses/{courseId}/thumbnail`

- Permission: `courses.manage`.
- Menghapus referensi database dan file persisten thumbnail aktif.

## GET `/courses/thumbnails/{filename}`

- Public untuk kebutuhan katalog.
- Hanya menerima nama acak yang dibuat server.
- Respons memakai immutable cache karena setiap penggantian menghasilkan URL baru.

## POST `/admin/courses/{courseId}/publish`

Rules:

- Minimal satu active module.
- Minimal satu active lesson.
- Required lesson count lebih dari nol.

## POST `/admin/courses/{courseId}/archive`

## DELETE `/admin/courses/{courseId}`

Hanya diperbolehkan jika belum pernah memiliki enrollment atau progress. Selain itu gunakan archive.

---

## 10. Modules

## POST `/admin/courses/{courseId}/modules`

```json
{
  "title": "Fundamental",
  "description": "string",
  "position": 1,
  "estimatedMinutes": 120,
  "isActive": true
}
```

## PATCH `/admin/modules/{moduleId}`

## DELETE `/admin/modules/{moduleId}`

Business rule mengikuti histori course.

## PUT `/admin/courses/{courseId}/modules/order`

```json
{
  "moduleIds": [
    "uuid-1",
    "uuid-2"
  ]
}
```

---

## 11. Lessons

## POST `/admin/modules/{moduleId}/lessons`

```json
{
  "title": "Apa Itu AI?",
  "description": "string",
  "contentType": "VIDEO",
  "mediaAssetId": "uuid",
  "textContent": null,
  "externalUrl": null,
  "position": 1,
  "estimatedMinutes": 15,
  "isRequired": true,
  "isPreview": false,
  "isActive": true,
  "completionRule": "MANUAL"
}
```

`contentType`:

```text
VIDEO
TEXT
PDF
EXTERNAL_LINK
```

`completionRule`:

```text
MANUAL
OPENED
MINIMUM_ACTIVE_SECONDS
VIDEO_PERCENTAGE
```

## PATCH `/admin/lessons/{lessonId}`

## DELETE `/admin/lessons/{lessonId}`

## PUT `/admin/modules/{moduleId}/lessons/order`

## PUT `/admin/lessons/{lessonId}/prerequisites`

```json
{
  "prerequisiteLessonIds": [
    "uuid"
  ]
}
```

---

## 12. Enrollment

## GET `/admin/courses/{courseId}/enrollments`

Query:

```text
page
pageSize
status
search
riskLevel
```

## POST `/admin/courses/{courseId}/enrollments`

```json
{
  "userIds": [
    "uuid-1",
    "uuid-2"
  ],
  "accessStartsAt": "2026-08-01T00:00:00Z",
  "accessEndsAt": null
}
```

Response may contain per-user success and conflict.

## GET `/admin/enrollments/{enrollmentId}`

## PATCH `/admin/enrollments/{enrollmentId}`

```json
{
  "accessStartsAt": "2026-08-01T00:00:00Z",
  "accessEndsAt": "2027-08-01T00:00:00Z"
}
```

## POST `/admin/enrollments/{enrollmentId}/remove`

## POST `/admin/enrollments/{enrollmentId}/reactivate`

## GET `/me/enrollments`

Returns current user's course access.

---

## 13. Learning Delivery

## GET `/learn/courses/{courseId}`

Requires active enrollment.

Returns:

- Course summary.
- Ordered modules.
- Lesson status.
- Progress.
- Last lesson.
- Next recommended lesson.

## GET `/learn/lessons/{lessonId}`

Requires:

- Active enrollment.
- Published course.
- Active lesson.
- Prerequisite satisfied.

Response:

```json
{
  "data": {
    "id": "uuid",
    "title": "Apa Itu AI?",
    "contentType": "VIDEO",
    "content": {
      "streamUrl": "signed-or-provider-url"
    },
    "status": "IN_PROGRESS",
    "previousLessonId": null,
    "nextLessonId": "uuid",
    "courseProgress": 12.5
  }
}
```

## POST `/learn/lessons/{lessonId}/open`

Optional idempotent activity endpoint.

```json
{
  "sessionId": "uuid",
  "source": "COURSE_PLAYER"
}
```

## POST `/learn/lessons/{lessonId}/complete`

Header:

```text
Idempotency-Key: uuid
```

Request:

```json
{
  "sessionId": "uuid",
  "completionEvidence": {
    "activeSeconds": 850,
    "videoPercentage": 96
  }
}
```

Response:

```json
{
  "data": {
    "lessonStatus": "COMPLETED",
    "courseProgress": 25,
    "courseStatus": "IN_PROGRESS",
    "nextLessonId": "uuid"
  }
}
```

## GET `/me/continue-learning`

Returns the highest-priority active learning item.

```json
{
  "data": {
    "enrollmentId": "uuid",
    "course": {
      "id": "uuid",
      "title": "AI Fundamentals",
      "shortDescription": "Dasar penerapan AI"
    },
    "lesson": {
      "id": "uuid",
      "title": "Pengenalan AI",
      "contentType": "VIDEO",
      "moduleTitle": "Mulai di sini"
    },
    "progressPercent": 25,
    "lastActivityAt": "2026-07-30T08:00:00.000Z"
  }
}
```

Returns `data: null` when no active enrollment is currently accessible.
Selection is scoped to the authenticated user, published courses, and valid
access windows.

## GET `/me/learning-history`

Cursor pagination:

```text
cursor
limit
courseId
from
to
eventType
```

The MVP endpoint implements `cursor` and `limit`; `limit` defaults to 20 and is
capped at 50. Each item contains course, module, lesson, activity type,
timestamp, duration when available, and progress after completion when
available. Results are always scoped to the authenticated user. The remaining
filters above are reserved for the reporting iteration.

---

## 14. Discussions

## GET `/courses/{courseId}/discussions`

Requires course access.

Query:

```text
page
pageSize
search
status
lessonId
sort
```

## POST `/courses/{courseId}/discussions`

```json
{
  "moduleId": null,
  "lessonId": "uuid",
  "title": "Pertanyaan tentang automation",
  "body": "..."
}
```

## GET `/discussions/{discussionId}`

## PATCH `/discussions/{discussionId}`

Owner or moderator.

## DELETE `/discussions/{discussionId}`

Owner or moderator, soft delete.

## POST `/discussions/{discussionId}/replies`

```json
{
  "parentReplyId": null,
  "body": "..."
}
```

## PATCH `/replies/{replyId}`

## DELETE `/replies/{replyId}`

## PUT `/discussions/{discussionId}/reaction`

```json
{
  "reaction": "HELPFUL"
}
```

## PUT `/replies/{replyId}/reaction`

## POST `/discussions/{discussionId}/report`

## POST `/replies/{replyId}/report`

---

## 15. Discussion Moderation

Requires `discussions.moderate`.

## GET `/admin/discussion-reports`

## POST `/admin/discussions/{discussionId}/lock`

## POST `/admin/discussions/{discussionId}/resolve`

## POST `/admin/discussions/{discussionId}/hide`

## POST `/admin/discussions/{discussionId}/pin`

## POST `/admin/discussions/{discussionId}/best-answer/{replyId}`

All moderation actions are audited.

---

## 16. Announcements

## GET `/announcements`

Returns relevant active announcements.

## GET `/announcements/{announcementId}`

Marks read through separate endpoint or explicit action.

## POST `/announcements/{announcementId}/read`

## GET `/admin/announcements`

## POST `/admin/announcements`

```json
{
  "title": "Kelas Baru",
  "body": "...",
  "publishAt": "2026-08-01T12:00:00Z",
  "expiresAt": null,
  "targets": [
    {
      "type": "LEARNING_PATH",
      "id": "uuid"
    }
  ]
}
```

## PATCH `/admin/announcements/{announcementId}`

## POST `/admin/announcements/{announcementId}/publish`

## POST `/admin/announcements/{announcementId}/cancel`

---

## 17. Notifications

## GET `/notifications`

Cursor pagination.

## POST `/notifications/{notificationId}/read`

## POST `/notifications/read-all`

## GET `/notifications/unread-count`

---

## 18. Media

## POST `/media/upload-intents`

```json
{
  "purpose": "LESSON_PDF",
  "fileName": "module-1.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576
}
```

Response:

```json
{
  "data": {
    "assetId": "uuid",
    "uploadUrl": "signed-url",
    "headers": {},
    "expiresAt": "2026-08-01T12:05:00Z"
  }
}
```

## POST `/media/{assetId}/confirm`

## GET `/media/{assetId}`

Returns metadata only.

## POST `/media/{assetId}/download-url`

Requires resource authorization.

---

## 19. Master Dashboard

Requires `analytics.read`.

## GET `/admin/analytics/dashboard`

Query:

```text
days=7..90
```

Returns traceable metrics from server-produced `learning_events` and progress data:

- Unique active learners.
- Lesson opens and completions.
- Recorded active learning minutes.
- Course ranking by learning activity.
- Enrollment count, average progress, and completion rate per course.
- Daily activity series.

## GET `/admin/dashboard/overview`

Query:

```text
from
to
courseId
primaryGoal
```

Returns:

- Total learner.
- Active learner.
- Inactive learner.
- Average progress.
- Completion rate.
- At-risk count.
- Forum participation.
- Top and bottom course.

## GET `/admin/dashboard/activity-series`

## GET `/admin/dashboard/actionable-insights`

Example:

```json
{
  "data": [
    {
      "type": "HIGH_DROPOFF_LESSON",
      "severity": "HIGH",
      "title": "Materi Prompt Engineering memiliki drop-off 38%",
      "resource": {
        "type": "LESSON",
        "id": "uuid"
      },
      "action": {
        "label": "Lihat materi",
        "url": "/master/lessons/uuid/analytics"
      }
    }
  ]
}
```

---

## 20. User Analytics

## GET `/admin/analytics/users/{userId}`

Returns:

- Learning profile.
- Course progress.
- Active days.
- Session duration.
- Recent activity.
- Repeated lessons.
- Risk score and reasons.

## GET `/admin/analytics/at-risk-users`

Query:

```text
page
pageSize
riskLevel
courseId
primaryGoal
inactiveDaysMin
```

---

## 21. Course Analytics

## GET `/admin/analytics/courses/{courseId}`

Returns:

- Enrollments.
- Start rate.
- Completion rate.
- Average progress.
- Average completion time.
- Drop-off lessons.
- Discussion activity.
- Segment breakdown.

## GET `/admin/analytics/lessons/{lessonId}`

Returns:

- Unique viewers.
- Completion.
- Repeat view.
- Average active time.
- Drop-off.
- Discussion count.

## GET `/admin/analytics/segments`

Groups by:

```text
AI_FOR_BUSINESS
AI_FOR_MARKETING
LEARN_CODING
LEARN_AI
AI_JOB_READINESS
```

---

## 22. Reports

Requires `reports.export`.

## POST `/admin/reports`

```json
{
  "reportType": "COURSE_PROGRESS",
  "format": "CSV",
  "filters": {
    "courseId": "uuid",
    "status": "IN_PROGRESS"
  }
}
```

Returns `202 Accepted`.

## GET `/admin/reports/{reportId}`

## POST `/admin/reports/{reportId}/download-url`

Only available when status is `COMPLETED`.

---

## 23. Audit

Requires `audit.read`.

## GET `/admin/audit-logs`

Query:

```text
cursor
limit
actorUserId
action
targetType
targetId
from
to
```

Audit data excludes secret and credential values.

---

## 24. Health and Operations

## GET `/health/live`

No authentication.

## GET `/health/ready`

May be restricted at edge.

Checks:

- Database.
- Redis critical connection.
- Migration compatibility.

## GET `/metrics`

Private infrastructure endpoint only.

---

## 25. Pagination

### Page-Based

Digunakan untuk management list:

```text
page=1
pageSize=20
```

Maximum `pageSize` ditentukan per endpoint.

### Cursor-Based

Digunakan untuk:

- Notifications.
- Activity.
- Audit.
- Learning history.

Response:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "opaque-value",
    "hasMore": true,
    "requestId": "uuid"
  }
}
```

---

## 26. Sorting and Filtering

Format sort:

```text
sort=-createdAt,title
```

Allow-list field per endpoint. Raw database column tidak diterima langsung dari client.

Filter harus tervalidasi dan terdokumentasi.

---

## 27. Idempotency

Mutation berikut menggunakan `Idempotency-Key`:

- Lesson completion.
- Bulk enrollment.
- Report request.
- Payment pada fase berikutnya.
- External webhook processing.

Server menyimpan:

- Key.
- User or client.
- Request hash.
- Response status.
- Response body reference.
- Expiration.

Key sama dengan request berbeda menghasilkan `409 IDEMPOTENCY_CONFLICT`.

---

## 28. Rate Limiting

Minimum:

| Endpoint | Kebijakan |
|---|---|
| Login | Ketat per IP dan email |
| Forgot password | Ketat dan tidak membocorkan akun |
| MFA verify | Ketat per challenge |
| Discussion create | Per user |
| Report create | Per Master |
| Upload intent | Per user dan purpose |
| Analytics | Per Master dan endpoint |
| General API | Global user/IP bucket |

Response menggunakan `429 RATE_LIMITED`.

---

## 29. OpenAPI and Client Generation

CI harus memeriksa:

- OpenAPI spec valid.
- API client generated terbaru.
- Breaking change terdeteksi.
- DTO example tersedia untuk endpoint utama.
- Auth requirement tercantum.
- Error response terdokumentasi.

Generated client diletakkan pada:

```text
packages/api-client
```

---

## 30. API Contract Acceptance Criteria

API contract siap jika:

- Seluruh feature P0 memiliki endpoint.
- Role dan permission setiap endpoint jelas.
- Request dan response utama tersedia.
- Error code terdokumentasi.
- Pagination dipilih.
- Idempotency endpoint kritis tersedia.
- File flow menggunakan signed upload.
- Analytics membaca read model.
- Security reviewer menyetujui auth dan authorization.
- Frontend engineer dapat menghasilkan client tanpa menebak struktur data.

## 31. Video API

### POST `/admin/videos/upload-intents`

Requires `courses.manage`.

```json
{
  "lessonId": "uuid",
  "title": "Dasar Prompt Engineering",
  "fileName": "lesson-01.mp4",
  "sizeBytes": 104857600
}
```

Response:

```json
{
  "data": {
    "videoAssetId": "uuid",
    "provider": "SELF_HOSTED",
    "providerVideoId": "provider-video-guid",
    "uploadUrl": "/api/v1/admin/videos/uuid/content",
    "method": "PUT",
    "headers": {
      "Content-Type": "video/mp4",
      "Content-Length": "104857600"
    }
  }
}
```

API key tidak pernah dikembalikan. File type, ukuran, lesson, dan permission harus divalidasi.

Untuk `SELF_HOSTED`, klien mengirim body MP4 mentah ke `uploadUrl`. Upload
bersifat streaming, wajib menyertakan `Content-Length`, dan hanya menerima MP4
browser-compatible. Tidak ada transcoding atau DRM.

### POST `/admin/videos/youtube`

Requires `courses.manage`. Menautkan pelajaran ke video YouTube alih-alih
mengunggah berkas. Lihat ADR-017.

```json
{
  "lessonId": "uuid",
  "title": "Dasar Prompt Engineering",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

Response:

```json
{
  "data": {
    "videoAssetId": "uuid",
    "provider": "YOUTUBE",
    "status": "AVAILABLE",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
}
```

Bentuk tautan yang diterima: `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, dan
`/live/`, pada host YouTube yang dikenal. Selain itu dijawab `422`. Video
menjadi `AVAILABLE` seketika karena tidak ada berkas yang perlu diproses, dan
video yang sedang aktif pada pelajaran tersebut ditandai `DELETED`.

### POST `/webhooks/bunny-stream`

Menerima status `CREATED`, `UPLOADING`, `PROCESSING`, `AVAILABLE`, `FAILED`, atau `DELETED`.

Webhook wajib diverifikasi, replay-protected, dan tidak boleh dipercaya untuk menentukan permission pengguna.

### GET `/admin/videos/{videoAssetId}`

Mengembalikan metadata processing untuk Master yang berwenang.

### DELETE `/admin/videos/{videoAssetId}`

Menghapus video provider dan menandai asset internal sebagai deleted sesuai retention rule.

### POST `/learn/lessons/{lessonId}/playback-sessions`

Requires active account, active enrollment, valid access period, published course, active lesson, completed prerequisite, dan video `AVAILABLE`.

```json
{
  "deviceId": "opaque-device-id"
}
```

Response:

```json
{
  "data": {
    "playbackSessionId": "uuid",
    "provider": "SELF_HOSTED",
    "providerVideoId": "provider-video-guid",
    "kind": "FILE",
    "playbackUrl": "/api/v1/playback-sessions/uuid/content",
    "embedUrl": null,
    "expiresAt": "2026-07-28T12:05:00Z",
    "drm": {
      "enabled": false,
      "type": "NONE"
    },
    "watermark": {
      "text": "user@example.com • 91BA",
      "mode": "MOVING"
    }
  }
}
```

`kind` menentukan cara memutar dan hanya satu URL yang terisi:

- `FILE` — video dialirkan oleh server ini. `playbackUrl` terisi, `embedUrl` null.
- `EMBED` — video diputar penyedia luar di dalam iframe. `embedUrl` terisi
  (`youtube-nocookie.com/embed/...`), `playbackUrl` null. Endpoint konten tidak
  pernah melayani aset semacam ini.

Playback URL bersifat singkat, scoped ke video, dibuat server-side, tidak disimpan permanen, dan tidak dicatat pada log.

### POST `/playback-sessions/{playbackSessionId}/heartbeat`

```json
{
  "positionSeconds": 420,
  "isPlaying": true
}
```

Digunakan untuk memvalidasi sesi, mendeteksi concurrent playback, dan mencatat active learning seconds.

### POST `/playback-sessions/{playbackSessionId}/end`

Mengakhiri active playback session.

---

## 32. Discussion Forum API

Mengikuti PRD 7.12. Pencabutan hak berpartisipasi mengikuti ADR-018.

Dua lapis pemeriksaan berlaku dan tidak boleh tertukar:

1. **Akses kursus** — Pelajar wajib punya enrollment aktif pada kursus pemilik
   forum. Gagal menghasilkan `404`, bukan `403`, agar keberadaan forum kursus
   lain tidak dapat disimpulkan.
2. **Hak berpartisipasi** — Pelajar yang haknya dicabut tetap boleh membaca dan
   melapor, tetapi ditolak `403` saat menulis, dengan alasan pencabutan
   disertakan pada pesan.

Konten berstatus `HIDDEN` dan balasan `isHidden` tidak pernah muncul pada
endpoint Pelajar, termasuk bagi penulisnya sendiri.

### Endpoint Pelajar

| Metode | Path | Keterangan |
| --- | --- | --- |
| GET | `/learn/courses/{courseId}/forum/topics` | Daftar topik; filter `lessonId`, `status`, `search`, `page`, `pageSize` |
| POST | `/learn/courses/{courseId}/forum/topics` | Membuat topik |
| GET | `/learn/forum/topics/{topicId}` | Detail topik beserta balasan |
| PATCH | `/learn/forum/topics/{topicId}` | Mengubah topik milik sendiri |
| DELETE | `/learn/forum/topics/{topicId}` | Menghapus topik milik sendiri |
| POST | `/learn/forum/topics/{topicId}/replies` | Membalas |
| PATCH | `/learn/forum/replies/{replyId}` | Mengubah balasan milik sendiri |
| DELETE | `/learn/forum/replies/{replyId}` | Menghapus balasan milik sendiri |
| POST | `/learn/forum/topics/{topicId}/reactions` | Menyalakan atau mematikan reaksi |
| POST | `/learn/forum/replies/{replyId}/reactions` | Menyalakan atau mematikan reaksi |
| POST | `/learn/forum/reports` | Melaporkan topik atau balasan |

Mengubah atau menghapus milik orang lain dijawab `403`. Menulis pada topik
berstatus `LOCKED` dijawab `409` dengan kode `DISCUSSION_LOCKED`.

Detail topik menyertakan dua medan bantu antarmuka:

```json
{
  "data": {
    "canParticipate": false,
    "participationBlockedReason": "Berkomentar kasar berulang kali."
  }
}
```

Keduanya hanya untuk menyembunyikan kotak balasan lebih awal. Server tetap
memeriksa ulang setiap permintaan tulis dan tidak pernah memercayai nilai ini.

### Endpoint Master

Seluruhnya memerlukan permission `discussions.moderate`.

| Metode | Path | Keterangan |
| --- | --- | --- |
| GET | `/admin/forum/topics` | Seluruh topik termasuk yang disembunyikan |
| PATCH | `/admin/forum/topics/{topicId}/status` | `OPEN`, `RESOLVED`, `LOCKED`, `HIDDEN` |
| PATCH | `/admin/forum/topics/{topicId}/pin` | Menyematkan |
| PATCH | `/admin/forum/topics/{topicId}/best-reply` | Menandai jawaban terbaik; `replyId` kosong membatalkan |
| POST | `/admin/forum/topics/{topicId}/replies` | Master ikut menjawab |
| PATCH | `/admin/forum/replies/{replyId}/hidden` | Menyembunyikan balasan |
| DELETE | `/admin/forum/topics/{topicId}` | Menghapus topik |
| DELETE | `/admin/forum/replies/{replyId}` | Menghapus balasan |
| GET | `/admin/forum/reports` | Daftar laporan; filter `status` |
| PATCH | `/admin/forum/reports/{reportId}` | Menutup laporan: `ACTIONED` atau `DISMISSED` |
| GET | `/admin/forum/bans` | Daftar pencabutan; `activeOnly` default true |
| POST | `/admin/forum/bans` | Mencabut hak berpartisipasi |
| DELETE | `/admin/forum/bans/{banId}` | Mengembalikan hak |

Menandai jawaban terbaik sekaligus mengubah status topik menjadi `RESOLVED`.

Mencabut hak berpartisipasi:

```json
{
  "userId": "uuid",
  "courseId": "uuid",
  "reason": "Berkomentar kasar berulang kali.",
  "expiresAt": "2026-08-30T00:00:00Z"
}
```

`courseId` kosong berarti seluruh forum. `expiresAt` kosong berarti berlaku
sampai dikembalikan. Mencabut dua kali pada cakupan yang sama dijawab `422`.
Pengembalian hak mengisi `revokedAt` dan tidak pernah menghapus barisnya.

---

## 33. Learner Insights API

Mengikuti PRD 8.2 (Insight Aktivitas Belajar) dan 8.6 (Student Risk Indicator).

### GET `/admin/analytics/insights`

Requires `analytics.read`. Query `days` menerima 7–90, default 30.

```json
{
  "data": {
    "periodDays": 30,
    "habit": {
      "dailyActiveLearners": 12,
      "weeklyActiveLearners": 48,
      "monthlyActiveLearners": 130,
      "averageStudyDaysPerLearner": 4.2,
      "averageMinutesPerStudyDay": 27.5,
      "returningLearners": 61,
      "busiestWeekday": "Selasa",
      "busiestHour": 20
    },
    "retention": { "sevenDay": 42.9, "thirtyDay": 38.1 },
    "forum": {
      "participationRate": 21.4,
      "contributors": 9,
      "eligibleLearners": 42,
      "topics": 15,
      "replies": 61,
      "topContributors": [{ "userId": "uuid", "fullName": "…", "topics": 3, "replies": 12 }]
    },
    "risk": {
      "counts": { "LOW": 96, "MEDIUM": 21, "HIGH": 13 },
      "learners": [
        {
          "userId": "uuid",
          "fullName": "…",
          "email": "…",
          "level": "HIGH",
          "reason": "Tidak aktif selama 21 hari.",
          "daysInactive": 21,
          "averageProgress": 12.5
        }
      ]
    }
  }
}
```

Definisi yang dipakai, agar angkanya tidak ditafsirkan keliru:

- **Aktif** berarti memiliki `learning_events` pada rentang tersebut. Membuka
  halaman tanpa menyentuh materi tidak dihitung.
- **`averageStudyDaysPerLearner`** menghitung hari berbeda seorang pelajar
  belajar, bukan total kunjungan.
- **`averageMinutesPerStudyDay`** membagi total durasi dengan jumlah pasangan
  (pelajar, hari aktif) — jadi hari ketika seseorang tidak belajar tidak
  menurunkan angkanya.
- **`retention`** adalah *tingkat kembali*: berapa persen pelajar yang aktif
  pada periode sebelumnya kembali aktif pada periode terakhir. Definisi ini
  dipilih karena dapat dihitung tanpa tabel kohort terpisah.
- **`busiestHour`** memakai zona waktu server.
- **`participationRate`** membandingkan penulis forum dengan `eligibleLearners`,
  yaitu semua pelajar berenrollment aktif — bukan hanya yang tercatat membuka
  materi. Seseorang dapat berdiskusi tanpa memicu satu pun `learning_event`,
  sehingga penyebut berbasis aktivitas dapat lebih kecil daripada pembilangnya
  dan menghasilkan angka yang mustahil.
- **`risk.learners`** hanya memuat level `MEDIUM` dan `HIGH`, maksimal 50 baris,
  diurutkan dari yang paling lama tidak aktif. Setiap baris wajib menyertakan
  `reason` sesuai PRD 8.6 acceptance criteria.

Klasifikasi risiko bersifat rule-based, bukan skoring, sesuai PRD 8.6:

| Level | Kondisi |
| --- | --- |
| `HIGH` | Tidak aktif ≥ 14 hari, atau belum pernah mulai padahal terdaftar ≥ 14 hari |
| `MEDIUM` | Tidak aktif 7–13 hari, atau progres kurang dari separuh rata-rata kohort |
| `LOW` | Selain itu, termasuk pelajar yang baru terdaftar |

---

## 34. Live Session API

Mengikuti PRD 7.16 dan ADR-019. LMS tidak memanggil API penyedia rapat mana pun.

### GET `/learn/courses/{courseId}/live-sessions`

Pelajar dengan enrollment aktif. Kursus yang tidak dimiliki dijawab `404`.

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Bedah studi kasus",
      "description": null,
      "startsAt": "2026-08-05T13:00:00Z",
      "endsAt": "2026-08-05T14:00:00Z",
      "durationMinutes": 60,
      "status": "UPCOMING",
      "joinUrl": null
    }
  ]
}
```

`status` bernilai `UPCOMING`, `LIVE`, atau `ENDED`. `joinUrl` hanya terisi
selama sesi belum berakhir; setelah itu bernilai null agar tautan lama tidak
terus beredar. Sesi yang dibatalkan tidak muncul sama sekali.

### Endpoint Master

Seluruhnya memerlukan permission `courses.manage`.

| Metode | Path | Keterangan |
| --- | --- | --- |
| GET | `/admin/live-sessions` | Semua sesi termasuk yang dibatalkan; filter `courseId` |
| POST | `/admin/live-sessions` | Menjadwalkan sesi |
| PATCH | `/admin/live-sessions/{sessionId}` | Mengubah jadwal, durasi, atau tautan |
| DELETE | `/admin/live-sessions/{sessionId}` | Membatalkan sesi |

```json
{
  "courseId": "uuid",
  "title": "Bedah studi kasus",
  "description": "Bawa pertanyaanmu.",
  "joinUrl": "https://zoom.us/j/1234567890",
  "startsAt": "2026-08-05T13:00:00Z",
  "durationMinutes": 60
}
```

`joinUrl` wajib `https` dan berasal dari host berikut atau subdomainnya:
`zoom.us`, `zoomgov.com`, `meet.google.com`, `teams.microsoft.com`,
`teams.live.com`, `whereby.com`, `meet.jit.si`. Selain itu dijawab `422`.

Daftar tertutup ini adalah kontrol keamanan: tautannya disiarkan ke seluruh
peserta kursus, sehingga kolom bebas akan menjadi sarana menyebar tautan apa
pun dengan kredibilitas akademi. Pencocokan dilakukan persis atau lewat akhiran
`.host`, sehingga `zoom.us.phishing.test` ditolak.

`durationMinutes` menerima 5 sampai 600. Pembatalan mengisi `cancelledAt` dan
tidak menghapus barisnya.

---

## 35. Notification API

Mengikuti PRD 7.14. Channel MVP hanya in-app; pengiriman email menyusul lewat
modul communication tanpa mengubah bentuk endpoint ini.

| Metode | Path | Keterangan |
| --- | --- | --- |
| GET | `/me/notifications` | Milik sendiri, terbaru dulu; filter `unreadOnly`, `page`, `pageSize` |
| GET | `/me/notifications/unread-count` | Jumlah yang belum dibaca |
| PATCH | `/me/notifications/{notificationId}/read` | Menandai satu sudah dibaca |
| POST | `/me/notifications/read-all` | Menandai seluruhnya sudah dibaca |

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "FORUM_REPLY",
      "title": "Diskusimu mendapat balasan",
      "body": "Bagaimana memulai proyek pertama?",
      "linkUrl": "/learn/uuid/forum/uuid",
      "readAt": null,
      "createdAt": "2026-07-31T02:00:00Z"
    }
  ]
}
```

Kepemilikan ditegakkan lewat klausa `where`, bukan diperiksa setelah baris
terbaca, sehingga notifikasi milik pengguna lain dijawab `404` dan
keberadaannya tidak dapat disimpulkan.

### Pemicu yang sudah aktif

| `type` | Penerima | Kejadian |
| --- | --- | --- |
| `FORUM_REPLY` | Penulis topik | Diskusinya dibalas orang lain |
| `FORUM_BEST_ANSWER` | Penulis balasan | Balasannya ditandai jawaban terbaik |
| `FORUM_PARTICIPATION_REVOKED` | Pelajar | Hak berdiskusinya dicabut |
| `FORUM_PARTICIPATION_RESTORED` | Pelajar | Hak berdiskusinya dipulihkan |
| `LIVE_SESSION_SCHEDULED` | Peserta kursus | Sesi langsung dijadwalkan |
| `FORUM_NEW_TOPIC` | Pemegang `discussions.moderate` | Ada diskusi baru |
| `FORUM_CONTENT_REPORTED` | Pemegang `discussions.moderate` | Konten dilaporkan |

Membalas diskusi sendiri tidak menghasilkan notifikasi.

### Preferensi

Jenis notifikasi dipetakan ke tiga saklar pada `notification_preferences`.
Pengguna tanpa baris preferensi memakai default aktif.

`FORUM_PARTICIPATION_REVOKED` dan `FORUM_PARTICIPATION_RESTORED` **selalu
dikirim** dan tidak dapat dibungkam. Tanpa keduanya, pelajar ditolak saat
menulis tanpa pernah tahu sebabnya, dan sistem akan terasa rusak.

### Belum aktif

Trigger PRD berikut belum dipasang karena bergantung pada modul yang belum
ada atau pekerjaan terjadwal: pengumuman baru, materi baru tersedia, kursus
diperbarui, ditambahkan ke kursus, kursus selesai, pelajar masuk kategori
high risk, kursus dengan drop-off tinggi, dan pertanyaan belum dijawab.
Nilai enum `ENROLLED_IN_COURSE` dan `COURSE_COMPLETED` sudah disediakan agar
pemasangannya nanti tidak memerlukan migrasi.

---

## 36. Announcement API

Mengikuti PRD 7.13.

### Endpoint Pelajar

| Metode | Path | Keterangan |
| --- | --- | --- |
| GET | `/me/announcements` | Pengumuman aktif yang relevan untukku |
| GET | `/me/announcements/unread-count` | Jumlah yang belum dibaca |
| POST | `/me/announcements/{announcementId}/read` | Menandai sudah dibaca |

Sebuah pengumuman baru terlihat pelajar bila **seluruh** syarat terpenuhi:

- `status` bernilai `PUBLISHED` — draft tidak pernah terlihat.
- `publishedAt` sudah lewat — penjadwalan dihormati, bukan sekadar disimpan.
- `endsAt` kosong atau belum lewat — yang berakhir berhenti tampil.
- Audiensnya cocok: `ALL_USERS`, atau `COURSE_LEARNERS` dengan enrollment aktif
  pada kursus itu, atau `SPECIFIC_USERS` yang menyertakan dirinya.

Menandai baca memeriksa ulang kelayakan yang sama, sehingga pengumuman yang
bukan untuknya dijawab `404` dan keberadaannya tidak dapat disimpulkan.

### Endpoint Master

Seluruhnya memerlukan permission `announcements.manage`.

| Metode | Path | Keterangan |
| --- | --- | --- |
| GET | `/admin/announcements` | Semua, termasuk draft dan arsip; filter `status` |
| POST | `/admin/announcements` | Membuat sebagai `DRAFT` |
| PATCH | `/admin/announcements/{id}` | Mengubah isi, audiens, atau jadwal |
| POST | `/admin/announcements/{id}/publish` | Menerbitkan dan memberi tahu penerima |
| POST | `/admin/announcements/{id}/archive` | Menghentikan tampil tanpa menghapus |
| DELETE | `/admin/announcements/{id}` | Menghapus permanen |

```json
{
  "title": "Libur akhir pekan",
  "body": "Kelas langsung ditiadakan Sabtu ini.",
  "audience": "COURSE_LEARNERS",
  "courseId": "uuid",
  "publishedAt": "2026-08-01T00:00:00Z",
  "endsAt": "2026-08-08T00:00:00Z"
}
```

`courseId` wajib untuk `COURSE_LEARNERS`; `userIds` wajib untuk
`SPECIFIC_USERS`. Selain itu dijawab `422`. Membuat selalu menghasilkan
`DRAFT`; penerbitan adalah langkah terpisah agar tulisan setengah jadi tidak
pernah sampai ke pelajar.

### Penjadwalan

`publishedAt` merangkap sebagai jadwal. Menerbitkan pengumuman dengan
`publishedAt` di masa depan membuat statusnya `PUBLISHED`, tetapi ia belum
lolos saringan kelayakan sehingga belum tampil bagi Pelajar sampai waktunya
tiba. Ini memenuhi acceptance criteria "Master dapat menjadwalkan pengumuman"
pada PRD 7.13.

Menerbitkan tetap tindakan sadar seorang Master. `DRAFT` dengan `publishedAt`
yang sudah lewat tidak terbit dengan sendirinya — tulisan setengah jadi tidak
boleh tersiar karena tanggalnya kebetulan terlampaui.

### Notifikasi

Menerbitkan mengirim notifikasi `ANNOUNCEMENT_PUBLISHED` kepada penerimanya,
melengkapi trigger "Pengumuman baru" pada PRD 7.14.

Untuk pengumuman terjadwal, notifikasinya dikirim oleh `AnnouncementScheduler`
saat jadwalnya tiba, bukan saat diterbitkan — memberi tahu tentang sesuatu yang
belum dapat dibuka hanya mengarahkan pelajar ke halaman kosong. Penjadwalnya
berupa poller di dalam API dengan jeda `ANNOUNCEMENT_SCHEDULER_INTERVAL_SECONDS`,
jadi pemberitahuan dapat terlambat sebesar satu jeda itu.

Kolom `notified_at` menjaga agar notifikasi tidak terkirim dua kali. Pengumuman
diklaim lebih dulu baru diberitahukan; bila pengirimannya gagal setelah klaim,
isinya tetap tampil di halaman dan yang hilang hanya dorongannya. Urutan ini
kebalikan dari relay outbox, dan disengaja: pengiriman ganda di sini berarti
ratusan pelajar menerima notifikasi yang sama dua kali.

Pengumuman yang `endsAt`-nya sudah lewat sebelum sempat diberitahukan
dilewati.

---

## 37. Error Monitoring API

Memenuhi PRD 12.7. Perilaku dan alasan desainnya ada di
`docs/operations/INCIDENT_RESPONSE.md` §0a.

### Endpoint Master

Seluruhnya memerlukan permission `audit.read`.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/admin/errors` | Daftar galat, terbaru lebih dulu |
| GET | `/admin/errors/summary` | Jumlah terbuka, selesai, dan terlihat 24 jam terakhir |
| POST | `/admin/errors/{errorId}/resolve` | Menandai sudah ditangani |
| POST | `/admin/errors/{errorId}/reopen` | Membuka kembali |

Query pada `/admin/errors`: `status` (`OPEN`, `RESOLVED`), `source` (`API`,
`WEB`, `WORKER`), `page`, `pageSize`.

```json
{
  "id": "42",
  "fingerprint": "a1b2c3…",
  "source": "API",
  "status": "OPEN",
  "type": "TypeError",
  "message": "Tidak dapat membaca properti id",
  "stack": "TypeError: …",
  "context": { "method": "GET", "path": "/users/:id", "statusCode": 500 },
  "occurrences": 128,
  "firstSeenAt": "2026-07-31T09:00:00Z",
  "lastSeenAt": "2026-07-31T14:22:00Z",
  "resolvedAt": null
}
```

`id` adalah string, bukan angka: kuncinya `BIGSERIAL` dan JSON tidak mengenal
`BigInt`. `errorId` yang bukan angka dijawab `404`, bukan `422` — dari sisi
pemanggil keduanya sama-sama berarti tidak ada.

`resolve` bukan janji bahwa galatnya tidak akan kembali. Bila fingerprint yang
sama muncul lagi, statusnya otomatis kembali `OPEN`.

### POST `/telemetry/client-errors`

Publik, tanpa sesi dan tanpa CSRF. Galat pada halaman login dan pendaftaran
justru yang paling perlu diketahui, dan di sana belum ada sesi.

```json
{
  "type": "TypeError",
  "message": "x.map bukan fungsi",
  "stack": "TypeError: …",
  "path": "/courses"
}
```

Balasan `202` tanpa badan. `source` selalu `WEB` dan ditentukan server — bukan
oleh pelapor. Batas panjang: `type` 200, `message` 500, `stack` 4000, `path`
300; melebihi itu dijawab `422`. Field di luar daftar juga `422`.

Batas laju per IP diatur `CLIENT_ERROR_MAX_PER_HOUR` (default 30); melebihi itu
dijawab `429`.

---

## 38. Audit Log API

Sisi baca untuk PRD 13. Penulisannya sudah ada sejak awal; sebelumnya tidak ada
cara membacanya selain query SQL langsung ke produksi.

Seluruh endpoint memerlukan permission `audit.read`.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/admin/audit-logs` | Riwayat tindakan, terbaru lebih dulu |
| GET | `/admin/audit-logs/actions` | Jenis tindakan yang pernah tercatat |

Query: `actorUserId`, `action`, `targetType`, `targetId`, `from`, `to`, `page`,
`pageSize`.

`action` dicocokkan berdasarkan **awalan**, bukan kecocokan penuh: `user.`
menyaring seluruh tindakan atas pengguna tanpa perlu menyebutnya satu per satu.

```json
{
  "id": "1284",
  "action": "user.deleted",
  "targetType": "User",
  "targetId": "uuid",
  "actor": { "id": "uuid", "fullName": "Nama Master", "email": "master@…" },
  "beforeData": { "status": "ACTIVE" },
  "afterData": { "status": "SUSPENDED" },
  "requestId": "uuid",
  "ipAddress": "203.0.113.9",
  "userAgent": "Mozilla/5.0 …",
  "createdAt": "2026-07-31T14:22:00Z"
}
```

`id` adalah string karena kuncinya `BIGSERIAL`.

`actor` bernilai `null` bila akun pelakunya sudah dihapus. Relasinya memakai
`ON DELETE SET NULL`, jadi menghapus akun tidak menghapus jejak apa yang pernah
dilakukannya.

`/actions` mengembalikan daftar yang dihitung dari data, bukan daftar tetap
yang ditulis tangan — daftar tangan akan basi begitu ada tindakan baru yang
dicatat.
