# Learning Analytics Event Dictionary

## 1. Rules

- Event name menggunakan `snake_case`.
- Setiap event memiliki `event_uuid`.
- Timestamp menggunakan UTC.
- Event schema memiliki version.
- Consumer harus idempotent.
- Metadata menggunakan allow-list.
- Password, token, secret, dan raw sensitive content dilarang.
- Event business-critical berasal dari server.
- Client event tidak boleh menjadi sumber kebenaran completion.

## 2. Common Envelope

```json
{
  "eventUuid": "uuid",
  "eventName": "lesson_completed",
  "schemaVersion": 1,
  "occurredAt": "2026-08-01T10:00:00Z",
  "userId": "uuid",
  "sessionId": "uuid",
  "courseId": "uuid",
  "moduleId": "uuid",
  "lessonId": "uuid",
  "source": "WEB",
  "deviceType": "DESKTOP",
  "metadata": {}
}
```

## 3. Event Catalogue

| Event | Producer | Trigger | Required Properties | Main Consumers |
|---|---|---|---|---|
| user_logged_in | Identity API | Login success | userId, sessionId | Security analytics |
| user_logged_out | Identity API | Session revoked | userId, sessionId | Security analytics |
| learning_goal_selected | Learning Profile API | Goal saved | userId, primaryGoal | Segment analytics |
| course_viewed | Delivery API | Accessible course viewed | userId, courseId | Engagement |
| course_started | Progress API | First valid lesson open | userId, courseId, enrollmentId | Start rate |
| module_opened | Delivery API | Module outline opened | userId, moduleId | Engagement |
| lesson_opened | Delivery API | Valid lesson access | userId, lessonId, enrollmentId | Viewer metrics |
| lesson_completed | Progress API | Completion transaction commit | userId, lessonId, enrollmentId | Progress analytics |
| lesson_reopened | Delivery API | Completed lesson opened again | userId, lessonId | Repeat views |
| course_completed | Progress API | All required lessons complete | userId, courseId, enrollmentId | Completion rate |
| learning_session_started | Delivery API | Learning session starts | userId, sessionId | Session analytics |
| learning_session_ended | Session worker/API | Session ends | sessionId, activeSeconds | Duration |
| discussion_created | Community API | Topic created | userId, discussionId, courseId | Participation |
| discussion_replied | Community API | Reply created | userId, discussionId | Participation |
| discussion_reported | Community API | Content reported | reporterId, targetId | Moderation |
| announcement_viewed | Communication API | Announcement marked read | userId, announcementId | Reach |
| material_downloaded | Media API | Signed download created/used | userId, assetId, courseId | Content analytics |
| report_requested | Reporting API | Export queued | userId, reportType | Audit |
| user_risk_level_changed | Analytics worker | Risk snapshot changes | userId, enrollmentId, from, to | Actionable insight |

## 4. Metric Definitions

### Daily Active Learner

Unique user dengan minimal satu dari:

- course_viewed
- lesson_opened
- lesson_completed
- discussion_created
- discussion_replied

dalam satu UTC day atau reporting timezone yang dipilih.

### Course Start Rate

```text
Unique enrollment dengan course_started
/
Eligible active enrollment
× 100
```

### Course Completion Rate

```text
Unique enrollment dengan course_completed
/
Enrollment yang memulai course
× 100
```

### Lesson Drop-off

Baseline MVP:

```text
Unique user yang membuka lesson
tetapi tidak complete lesson dan tidak melanjutkan dalam threshold
/
Unique user yang membuka lesson
```

Threshold awal: tujuh hari. Rule version wajib dicatat.

### Repeat View

Lesson dibuka setelah `view_count > 1` atau setelah completion.

### Risk Score

Input:

- Days inactive.
- Days without progress.
- Progress vs course average.
- Repeated lesson without completion.
- Login without learning.

Risk output selalu menyimpan:

- Score.
- Level.
- Reasons.
- Rule version.
- Calculated timestamp.

## 5. Retention

| Event Category | Retention Baseline |
|---|---|
| Authentication event | 12 months |
| Learning event raw | 24 months |
| Forum participation event | 24 months |
| Aggregate daily metric | Long-term |
| Security event | 12–24 months |
| Debug/client telemetry | 30–90 days |

Retention final mengikuti privacy dan storage policy.
