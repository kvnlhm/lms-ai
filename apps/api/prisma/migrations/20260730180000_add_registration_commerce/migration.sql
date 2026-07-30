CREATE TYPE "PaymentOrderStatus" AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED'
);

CREATE TYPE "PaymentProvider" AS ENUM ('MIDTRANS');

CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

CREATE TABLE "access_tiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_idr" INTEGER NOT NULL,
  "duration_months" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "access_tiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_tiers_price_idr_check" CHECK ("price_idr" >= 0),
  CONSTRAINT "access_tiers_duration_months_check"
    CHECK ("duration_months" IS NULL OR "duration_months" > 0)
);

CREATE UNIQUE INDEX "access_tiers_slug_key" ON "access_tiers"("slug");
CREATE INDEX "access_tiers_is_active_position_idx" ON "access_tiers"("is_active", "position");

CREATE TABLE "access_tier_courses" (
  "tier_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "access_tier_courses_pkey" PRIMARY KEY ("tier_id", "course_id"),
  CONSTRAINT "access_tier_courses_tier_id_fkey"
    FOREIGN KEY ("tier_id") REFERENCES "access_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "access_tier_courses_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "access_tier_courses_tier_id_position_key"
  ON "access_tier_courses"("tier_id", "position");

CREATE TABLE "registration_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_code" TEXT NOT NULL,
  "tier_id" UUID NOT NULL,
  "full_name" TEXT NOT NULL,
  "email" CITEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "gross_amount" INTEGER NOT NULL,
  "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
  "payment_provider" "PaymentProvider" NOT NULL DEFAULT 'MIDTRANS',
  "snap_token" TEXT,
  "redirect_url" TEXT,
  "provider_transaction_id" TEXT,
  "payment_type" TEXT,
  "fraud_status" TEXT,
  "paid_at" TIMESTAMPTZ(6),
  "access_starts_at" TIMESTAMPTZ(6),
  "access_ends_at" TIMESTAMPTZ(6),
  "provisioned_user_id" UUID,
  "email_delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "whatsapp_delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "delivery_error" TEXT,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "registration_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "registration_orders_gross_amount_check" CHECK ("gross_amount" >= 0),
  CONSTRAINT "registration_orders_tier_id_fkey"
    FOREIGN KEY ("tier_id") REFERENCES "access_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "registration_orders_provisioned_user_id_fkey"
    FOREIGN KEY ("provisioned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "registration_orders_order_code_key"
  ON "registration_orders"("order_code");
CREATE INDEX "registration_orders_email_status_idx"
  ON "registration_orders"("email", "status");
CREATE INDEX "registration_orders_status_created_at_idx"
  ON "registration_orders"("status", "created_at");

CREATE TABLE "payment_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "provider_event_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhook_events_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "registration_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_webhook_events_provider_event_key_key"
  ON "payment_webhook_events"("provider_event_key");
CREATE INDEX "payment_webhook_events_order_id_received_at_idx"
  ON "payment_webhook_events"("order_id", "received_at");

-- Nilai awal dapat diubah seluruhnya oleh Master setelah deployment.
INSERT INTO "access_tiers"
  ("slug", "name", "description", "price_idr", "duration_months", "is_active", "position", "updated_at")
VALUES
  (
    'akses-6-bulan',
    'Akses 6 Bulan',
    'Pilihan ringkas untuk mulai belajar dan menuntaskan materi inti.',
    999000,
    6,
    true,
    10,
    CURRENT_TIMESTAMP
  ),
  (
    'akses-12-bulan',
    'Akses 12 Bulan',
    'Waktu belajar lebih panjang untuk mendalami seluruh materi.',
    1499000,
    12,
    true,
    20,
    CURRENT_TIMESTAMP
  ),
  (
    'akses-lifetime',
    'Akses Lifetime',
    'Sekali bayar untuk akses tanpa tanggal berakhir.',
    2499000,
    NULL,
    true,
    30,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "access_tier_courses" ("tier_id", "course_id", "position")
SELECT
  tier."id",
  course."id",
  (ROW_NUMBER() OVER (PARTITION BY tier."id" ORDER BY course."created_at", course."id") - 1)::INTEGER
FROM "access_tiers" tier
CROSS JOIN "courses" course
WHERE tier."slug" IN ('akses-6-bulan', 'akses-12-bulan', 'akses-lifetime')
  AND course."status" = 'PUBLISHED'
ON CONFLICT DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'commerce.manage', 'Mengelola paket akses dan pembayaran')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" = 'commerce.manage'
WHERE r."code" = 'MASTER'
ON CONFLICT DO NOTHING;
