# Entity Relationship Design

## LMS Database Design v1.0

Dokumen ini mendefinisikan data model logical untuk MVP. Implementasi fisik menggunakan PostgreSQL dan Prisma.

---

## 1. Design Principles

- PostgreSQL menjadi system of record.
- Semua relation penting memiliki foreign key.
- Email dan identifier publik harus unik.
- Data historis progress tidak dihapus ketika account atau enrollment dinonaktifkan.
- Event dan audit bersifat append-only secara application behaviour.
- Semua waktu disimpan dalam UTC.
- Entity publik menggunakan UUID.
- Table analytics merupakan derived data dan dapat dibangun ulang dari event.
- JSONB hanya digunakan untuk metadata yang terkontrol.
- PII tidak dimasukkan ke metadata event tanpa kebutuhan eksplisit.

---

## 2. Core Identity ERD

```mermaid
erDiagram
    USERS ||--|| USER_LEARNING_PROFILES : has
    USERS ||--o{ USER_ROLES : assigned
    ROLES ||--o{ USER_ROLES : contains
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : included
    USERS ||--o{ AUTH_SESSIONS : owns
    USERS ||--o{ PASSWORD_RESET_TOKENS : requests
    USERS ||--o{ MFA_METHODS : configures

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar phone
        text bio
        varchar avatar_url
        varchar status
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    USER_LEARNING_PROFILES {
        uuid user_id PK,FK
        varchar primary_goal
        varchar experience_level
        varchar occupation
        varchar target_role
        integer weekly_minutes
        jsonb target_skills
        uuid preferred_learning_path_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    ROLES {
        uuid id PK
        varchar code UK
        varchar name
        timestamptz created_at
    }

    PERMISSIONS {
        uuid id PK
        varchar code UK
        varchar name
    }

    USER_ROLES {
        uuid user_id FK
        uuid role_id FK
        timestamptz assigned_at
    }

    ROLE_PERMISSIONS {
        uuid role_id FK
        uuid permission_id FK
    }

    AUTH_SESSIONS {
        uuid id PK
        uuid user_id FK
        varchar refresh_token_hash
        varchar device_name
        inet ip_address
        varchar user_agent
        timestamptz last_used_at
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }

    PASSWORD_RESET_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }

    MFA_METHODS {
        uuid id PK
        uuid user_id FK
        varchar type
        bytea encrypted_secret
        boolean is_primary
        timestamptz verified_at
        timestamptz created_at
    }
```

### Constraints

- `users.email` unique dan case-insensitive.
- MVP membatasi satu active role per user melalui unique `user_roles.user_id`.
- `status`: `ACTIVE`, `INACTIVE`, `SUSPENDED`.
- Refresh token hanya disimpan dalam bentuk hash.
- MFA diwajibkan oleh business rule untuk role Master.

---

## 3. Learning Catalog ERD

```mermaid
erDiagram
    LEARNING_PATHS ||--o{ LEARNING_PATH_COURSES : contains
    COURSES ||--o{ LEARNING_PATH_COURSES : included
    COURSE_CATEGORIES ||--o{ COURSES : categorises
    COURSES ||--o{ COURSE_MODULES : has
    COURSE_MODULES ||--o{ LESSONS : has
    LESSONS ||--o{ LESSON_PREREQUISITES : requires
    LESSONS ||--o{ LESSON_PREREQUISITES : prerequisite
    USERS ||--o{ COURSES : creates
    MEDIA_ASSETS ||--o{ COURSES : thumbnail
    MEDIA_ASSETS ||--o{ LESSONS : material

    LEARNING_PATHS {
        uuid id PK
        varchar slug UK
        varchar title
        text description
        varchar audience_type
        varchar status
        integer estimated_minutes
        timestamptz published_at
        timestamptz created_at
        timestamptz updated_at
    }

    LEARNING_PATH_COURSES {
        uuid learning_path_id FK
        uuid course_id FK
        integer position
        boolean is_required
    }

    COURSE_CATEGORIES {
        uuid id PK
        varchar slug UK
        varchar name
        timestamptz created_at
    }

    COURSES {
        uuid id PK
        uuid category_id FK
        uuid created_by FK
        uuid thumbnail_asset_id FK
        varchar slug UK
        varchar title
        text short_description
        text description
        varchar level
        varchar status
        integer estimated_minutes
        timestamptz published_at
        timestamptz archived_at
        timestamptz created_at
        timestamptz updated_at
    }

    COURSE_MODULES {
        uuid id PK
        uuid course_id FK
        varchar title
        text description
        integer position
        boolean is_active
        integer estimated_minutes
        timestamptz created_at
        timestamptz updated_at
    }

    LESSONS {
        uuid id PK
        uuid module_id FK
        uuid media_asset_id FK
        varchar title
        text description
        varchar content_type
        text text_content
        varchar external_url
        integer position
        integer estimated_minutes
        boolean is_required
        boolean is_preview
        boolean is_active
        varchar completion_rule
        jsonb completion_config
        timestamptz created_at
        timestamptz updated_at
    }

    LESSON_PREREQUISITES {
        uuid lesson_id FK
        uuid prerequisite_lesson_id FK
    }

    MEDIA_ASSETS {
        uuid id PK
        uuid owner_user_id FK
        varchar storage_provider
        varchar bucket
        varchar object_key UK
        varchar original_name
        varchar mime_type
        bigint size_bytes
        varchar status
        varchar checksum
        jsonb metadata
        timestamptz created_at
        timestamptz approved_at
        timestamptz deleted_at
    }
```

### Status

`learning_paths.status`:

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

`courses.status`:

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

`media_assets.status`:

- `UPLOADING`
- `PENDING_SCAN`
- `AVAILABLE`
- `REJECTED`
- `DELETED`

---

## 4. Enrollment and Progress ERD

```mermaid
erDiagram
    USERS ||--o{ ENROLLMENTS : owns
    COURSES ||--o{ ENROLLMENTS : receives
    ENROLLMENTS ||--|| COURSE_PROGRESS : has
    ENROLLMENTS ||--o{ LESSON_PROGRESS : tracks
    LESSONS ||--o{ LESSON_PROGRESS : tracked
    USERS ||--o{ LEARNING_SESSIONS : starts
    COURSES ||--o{ LEARNING_SESSIONS : relates
    LESSONS ||--o{ LEARNING_SESSIONS : relates

    ENROLLMENTS {
        uuid id PK
        uuid user_id FK
        uuid course_id FK
        varchar status
        timestamptz enrolled_at
        timestamptz access_starts_at
        timestamptz access_ends_at
        timestamptz completed_at
        timestamptz removed_at
        uuid enrolled_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    COURSE_PROGRESS {
        uuid id PK
        uuid enrollment_id UK,FK
        integer required_lessons_total
        integer required_lessons_completed
        decimal progress_percent
        uuid last_lesson_id FK
        timestamptz started_at
        timestamptz last_activity_at
        timestamptz completed_at
        integer version
        timestamptz created_at
        timestamptz updated_at
    }

    LESSON_PROGRESS {
        uuid id PK
        uuid enrollment_id FK
        uuid lesson_id FK
        varchar status
        integer view_count
        integer total_seconds
        timestamptz first_opened_at
        timestamptz last_opened_at
        timestamptz completed_at
        jsonb completion_evidence
        integer version
        timestamptz created_at
        timestamptz updated_at
    }

    LEARNING_SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid course_id FK
        uuid lesson_id FK
        timestamptz started_at
        timestamptz ended_at
        integer active_seconds
        varchar device_type
        varchar source
        timestamptz created_at
    }
```

### Constraints

- Unique `enrollments(user_id, course_id)` untuk enrollment aktif secara logical.
- Unique `lesson_progress(enrollment_id, lesson_id)`.
- `course_progress.progress_percent` antara 0 dan 100.
- `required_lessons_completed <= required_lessons_total`.
- Optimistic version tersedia untuk mencegah lost update.
- Histori tetap ada ketika enrollment berstatus `REMOVED` atau `EXPIRED`.

---

## 5. Community ERD

```mermaid
erDiagram
    COURSES ||--o{ DISCUSSIONS : contains
    COURSE_MODULES ||--o{ DISCUSSIONS : optional_scope
    LESSONS ||--o{ DISCUSSIONS : optional_scope
    USERS ||--o{ DISCUSSIONS : creates
    DISCUSSIONS ||--o{ DISCUSSION_REPLIES : has
    USERS ||--o{ DISCUSSION_REPLIES : creates
    DISCUSSIONS ||--o{ DISCUSSION_REACTIONS : receives
    DISCUSSION_REPLIES ||--o{ REPLY_REACTIONS : receives
    USERS ||--o{ DISCUSSION_REACTIONS : gives
    USERS ||--o{ REPLY_REACTIONS : gives
    DISCUSSIONS ||--o{ DISCUSSION_REPORTS : reported
    DISCUSSION_REPLIES ||--o{ REPLY_REPORTS : reported

    DISCUSSIONS {
        uuid id PK
        uuid course_id FK
        uuid module_id FK
        uuid lesson_id FK
        uuid author_user_id FK
        varchar title
        text body
        varchar status
        boolean is_pinned
        uuid best_reply_id FK
        integer reply_count
        timestamptz last_activity_at
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    DISCUSSION_REPLIES {
        uuid id PK
        uuid discussion_id FK
        uuid author_user_id FK
        uuid parent_reply_id FK
        text body
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    DISCUSSION_REACTIONS {
        uuid discussion_id FK
        uuid user_id FK
        varchar reaction
        timestamptz created_at
    }

    REPLY_REACTIONS {
        uuid reply_id FK
        uuid user_id FK
        varchar reaction
        timestamptz created_at
    }

    DISCUSSION_REPORTS {
        uuid id PK
        uuid discussion_id FK
        uuid reporter_user_id FK
        varchar reason
        text detail
        varchar status
        uuid reviewed_by FK
        timestamptz reviewed_at
        timestamptz created_at
    }

    REPLY_REPORTS {
        uuid id PK
        uuid reply_id FK
        uuid reporter_user_id FK
        varchar reason
        text detail
        varchar status
        uuid reviewed_by FK
        timestamptz reviewed_at
        timestamptz created_at
    }
```

### Constraints

- Pelajar hanya dapat membuat discussion dalam course yang diikuti.
- Unique reaction per user dan target.
- `best_reply_id` harus berasal dari discussion yang sama.
- Soft delete digunakan untuk moderation dan audit.

---

## 6. Communication ERD

```mermaid
erDiagram
    USERS ||--o{ ANNOUNCEMENTS : creates
    ANNOUNCEMENTS ||--o{ ANNOUNCEMENT_TARGETS : targets
    ANNOUNCEMENTS ||--o{ ANNOUNCEMENT_READS : read
    USERS ||--o{ ANNOUNCEMENT_READS : reads
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--|| NOTIFICATION_PREFERENCES : configures

    ANNOUNCEMENTS {
        uuid id PK
        uuid created_by FK
        varchar title
        text body
        varchar status
        timestamptz publish_at
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    ANNOUNCEMENT_TARGETS {
        uuid id PK
        uuid announcement_id FK
        varchar target_type
        uuid target_id
    }

    ANNOUNCEMENT_READS {
        uuid announcement_id FK
        uuid user_id FK
        timestamptz read_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        varchar type
        varchar title
        text body
        varchar action_url
        jsonb payload
        timestamptz read_at
        timestamptz created_at
    }

    NOTIFICATION_PREFERENCES {
        uuid user_id PK,FK
        boolean in_app_enabled
        boolean email_enabled
        jsonb event_preferences
        timestamptz updated_at
    }
```

`announcement_targets.target_type`:

- `ALL_USERS`
- `COURSE`
- `USER`
- `LEARNING_PATH`
- `AUDIENCE_SEGMENT`

Target polymorphic ini dikelola melalui application validation karena target dapat berasal dari beberapa aggregate.

---

## 7. Analytics and Audit ERD

```mermaid
erDiagram
    USERS ||--o{ LEARNING_EVENTS : generates
    COURSES ||--o{ LEARNING_EVENTS : relates
    LESSONS ||--o{ LEARNING_EVENTS : relates
    USERS ||--o{ ANALYTICS_USER_DAILY : summarised
    COURSES ||--o{ ANALYTICS_COURSE_DAILY : summarised
    LESSONS ||--o{ ANALYTICS_LESSON_DAILY : summarised
    USERS ||--o{ RISK_SNAPSHOTS : evaluated
    USERS ||--o{ AUDIT_LOGS : acts
    OUTBOX_MESSAGES ||--o{ OUTBOX_DELIVERIES : attempts

    LEARNING_EVENTS {
        bigint id PK
        uuid event_uuid UK
        varchar event_name
        integer schema_version
        uuid user_id FK
        uuid session_id
        uuid course_id FK
        uuid module_id FK
        uuid lesson_id FK
        timestamptz occurred_at
        integer duration_seconds
        varchar device_type
        varchar source
        jsonb metadata
        timestamptz created_at
    }

    ANALYTICS_USER_DAILY {
        date metric_date
        uuid user_id FK
        integer sessions
        integer active_seconds
        integer lessons_opened
        integer lessons_completed
        integer discussions_created
        decimal progress_delta
        timestamptz updated_at
    }

    ANALYTICS_COURSE_DAILY {
        date metric_date
        uuid course_id FK
        integer active_learners
        integer new_starts
        integer completions
        decimal average_progress
        integer discussion_count
        timestamptz updated_at
    }

    ANALYTICS_LESSON_DAILY {
        date metric_date
        uuid lesson_id FK
        integer unique_viewers
        integer completions
        integer repeat_views
        integer dropoffs
        decimal average_active_seconds
        timestamptz updated_at
    }

    RISK_SNAPSHOTS {
        uuid id PK
        uuid user_id FK
        uuid enrollment_id FK
        varchar risk_level
        integer score
        jsonb reasons
        varchar rule_version
        timestamptz calculated_at
    }

    OUTBOX_MESSAGES {
        uuid id PK
        uuid event_id UK
        varchar event_type
        varchar aggregate_type
        uuid aggregate_id
        jsonb payload
        integer schema_version
        timestamptz occurred_at
        timestamptz available_at
        timestamptz published_at
        integer attempts
        text last_error
    }

    OUTBOX_DELIVERIES {
        uuid id PK
        uuid outbox_message_id FK
        varchar destination
        varchar status
        integer attempt
        text error
        timestamptz attempted_at
    }

    AUDIT_LOGS {
        bigint id PK
        uuid actor_user_id FK
        varchar action
        varchar target_type
        uuid target_id
        jsonb before_data
        jsonb after_data
        uuid request_id
        inet ip_address
        varchar user_agent
        timestamptz created_at
    }
```

### Index Utama

`learning_events`:

- Unique `event_uuid`.
- `(user_id, occurred_at desc)`.
- `(course_id, occurred_at desc)`.
- `(lesson_id, occurred_at desc)`.
- `(event_name, occurred_at desc)`.

`outbox_messages`:

- Partial index pada `published_at is null`.
- `(available_at, occurred_at)` untuk publisher.

`risk_snapshots`:

- `(risk_level, calculated_at desc)`.
- `(enrollment_id, calculated_at desc)`.

---

## 8. Reporting ERD

```mermaid
erDiagram
    USERS ||--o{ REPORT_REQUESTS : requests
    REPORT_REQUESTS ||--o| MEDIA_ASSETS : produces

    REPORT_REQUESTS {
        uuid id PK
        uuid requested_by FK
        varchar report_type
        jsonb filters
        varchar format
        varchar status
        uuid output_asset_id FK
        integer row_count
        text failure_reason
        timestamptz requested_at
        timestamptz started_at
        timestamptz completed_at
        timestamptz expires_at
    }
```

Status:

- `QUEUED`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `EXPIRED`

---

## 9. Recommended Deletion Behaviour

| Entity | Behaviour |
|---|---|
| User | Suspend terlebih dahulu; anonymisation mengikuti retention policy |
| Course | Archive; hard delete hanya sebelum dipakai |
| Module/Lesson | Nonaktifkan; jangan menghapus histori progress |
| Enrollment | Ubah status menjadi Removed |
| Discussion | Soft delete |
| Learning event | Retention atau partition drop berdasarkan kebijakan |
| Audit log | Append-only dan retention khusus |
| Media asset | Mark deleted lalu lifecycle object storage |
| Notification | Dapat dihapus setelah retention |
| Report file | Expire otomatis |

---

## 10. Prisma Migration Rules

- Satu migration untuk satu perubahan logical.
- Migration production harus memiliki rollback plan.
- Rename menggunakan expand-and-contract.
- Kolom mandatory baru dibuat nullable atau memiliki default terlebih dahulu.
- Index besar dibuat dengan strategi yang tidak memblokir jika environment menuntut.
- Data backfill dijalankan sebagai job terkontrol.
- Migration tidak memanggil external API.
- CI menjalankan migration dari database kosong dan database baseline.

---

## 11. ERD Acceptance Criteria

ERD dianggap siap jika:

- Semua entity P0 memiliki table.
- Semua foreign key disetujui.
- Unique constraint enrollment dan progress tersedia.
- Deletion behaviour disetujui.
- Event metadata dan retention dibatasi.
- Index utama memiliki query justification.
- API contract dapat dipetakan ke entity.
- Security reviewer menyetujui penyimpanan credential dan token.
- Analytics engineer menyetujui raw event dan aggregate.

## 12. Video Assets

```text
VIDEO_ASSETS
- id
- lesson_id
- created_by
- provider
- provider_video_id
- object_key
- original_name
- mime_type
- size_bytes
- title
- status
- duration_seconds
- width
- height
- drm_enabled
- drm_type
- thumbnail_url
- processing_error
- created_at
- updated_at
- deleted_at

VIDEO_PLAYBACK_SESSIONS
- id
- video_asset_id
- user_id
- enrollment_id
- device_id
- status
- initial_ip
- started_at
- last_heartbeat_at
- ended_at

VIDEO_PROVIDER_EVENTS
- id
- video_asset_id
- provider_event_id
- event_type
- payload_summary
- received_at
- processed_at
- processing_error
```

Provider enum: `SELF_HOSTED`, `BUNNY_STREAM`.

Video status: `CREATED`, `UPLOADING`, `PROCESSING`, `AVAILABLE`, `FAILED`, `DELETED`.

DRM type: `NONE`, `MEDIACAGE_BASIC`, `MEDIACAGE_ENTERPRISE`.

Playback status: `ACTIVE`, `ENDED`, `EXPIRED`, `REVOKED`.

Constraints:

- Satu active video asset per lesson untuk MVP.
- `provider_video_id` unique.
- `provider_event_id` unique untuk replay protection.
- Playback session selalu terkait active enrollment.
- Playback token dan permanent URL tidak pernah disimpan.
- Provider secrets dan permanent playback URL tidak disimpan di database.
- `object_key` hanya diisi untuk provider self-hosted dan bukan public URL.
