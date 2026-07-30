CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "announcements_enabled" BOOLEAN NOT NULL DEFAULT true,
    "course_updates_enabled" BOOLEAN NOT NULL DEFAULT true,
    "learning_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "notification_preferences"
ADD CONSTRAINT "notification_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
