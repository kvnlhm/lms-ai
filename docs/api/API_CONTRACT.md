# REST API Contract

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

## POST `/auth/reset-password`

```json
{
  "token": "single-use-token",
  "password": "new-password",
  "passwordConfirmation": "new-password"
}
```

## GET `/auth/sessions`

Returns active devices for current user.

## DELETE `/auth/sessions/{sessionId}`

Revokes owned session.

---

## 6. Current User Profile

## GET `/me`

Returns profile and learning goal.

## PATCH `/me`

```json
{
  "fullName": "Freddie",
  "phone": "+62...",
  "avatarAssetId": "uuid"
}
```

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

## PATCH `/me/password`

Requires old password or recent authentication.

## GET `/me/notifications/preferences`

## PUT `/me/notifications/preferences`

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
    "playbackUrl": "/api/v1/playback-sessions/uuid/content",
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
