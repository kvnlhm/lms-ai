ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");
ALTER TABLE "registration_orders" ADD COLUMN "google_sub" TEXT;
