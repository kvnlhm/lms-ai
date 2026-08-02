-- A paid registration is academy membership, not access to selected courses.
-- Backfill every currently active paid member into every published course.
WITH paid_memberships AS (
  SELECT
    "provisioned_user_id" AS "user_id",
    BOOL_OR("access_ends_at" IS NULL) AS "has_lifetime_access",
    MAX("access_ends_at") AS "latest_access_end"
  FROM "registration_orders"
  WHERE "status" = 'PAID'
    AND "provisioned_user_id" IS NOT NULL
    AND ("access_ends_at" IS NULL OR "access_ends_at" > CURRENT_TIMESTAMP)
  GROUP BY "provisioned_user_id"
), eligible_access AS (
  SELECT
    paid_memberships."user_id",
    courses."id" AS "course_id",
    CASE
      WHEN paid_memberships."has_lifetime_access" THEN NULL
      ELSE paid_memberships."latest_access_end"
    END AS "access_ends_at"
  FROM paid_memberships
  CROSS JOIN "courses"
  WHERE courses."status" = 'PUBLISHED'
)
INSERT INTO "enrollments" (
  "id",
  "user_id",
  "course_id",
  "status",
  "enrolled_at",
  "access_starts_at",
  "access_ends_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  eligible_access."user_id",
  eligible_access."course_id",
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  eligible_access."access_ends_at",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM eligible_access
ON CONFLICT ("user_id", "course_id") DO UPDATE SET
  "status" = CASE
    WHEN "enrollments"."status" = 'COMPLETED' THEN 'COMPLETED'::"EnrollmentStatus"
    ELSE 'ACTIVE'::"EnrollmentStatus"
  END,
  "access_ends_at" = CASE
    WHEN "enrollments"."access_ends_at" IS NULL OR EXCLUDED."access_ends_at" IS NULL THEN NULL
    ELSE GREATEST("enrollments"."access_ends_at", EXCLUDED."access_ends_at")
  END,
  "removed_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;

WITH active_paid_users AS (
  SELECT DISTINCT "provisioned_user_id" AS "user_id"
  FROM "registration_orders"
  WHERE "status" = 'PAID'
    AND "provisioned_user_id" IS NOT NULL
    AND ("access_ends_at" IS NULL OR "access_ends_at" > CURRENT_TIMESTAMP)
), required_lesson_counts AS (
  SELECT
    modules."course_id",
    COUNT(lessons."id")::INTEGER AS "required_lessons_total"
  FROM "course_modules" modules
  LEFT JOIN "lessons" lessons
    ON lessons."module_id" = modules."id"
    AND lessons."is_active" = TRUE
    AND lessons."is_required" = TRUE
  WHERE modules."is_active" = TRUE
  GROUP BY modules."course_id"
)
INSERT INTO "course_progress" (
  "id",
  "enrollment_id",
  "required_lessons_total",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  enrollments."id",
  COALESCE(required_lesson_counts."required_lessons_total", 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "enrollments" enrollments
INNER JOIN active_paid_users ON active_paid_users."user_id" = enrollments."user_id"
INNER JOIN "courses" ON courses."id" = enrollments."course_id"
LEFT JOIN required_lesson_counts ON required_lesson_counts."course_id" = enrollments."course_id"
WHERE courses."status" = 'PUBLISHED'
ON CONFLICT ("enrollment_id") DO UPDATE SET
  "required_lessons_total" = EXCLUDED."required_lessons_total",
  "updated_at" = CURRENT_TIMESTAMP;
