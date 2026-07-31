-- Menyelaraskan database dengan schema.prisma.
--
-- Empat kolom ini ditulis tangan dengan default tingkat database, sementara
-- schema tidak menyatakannya. Akibatnya setiap `prisma migrate diff`
-- menghasilkan empat `DROP DEFAULT` yang tidak diminta siapa pun, dan
-- ikut terbawa ke migrasi berikutnya sebagai perubahan siluman.
--
-- Arahnya mengikuti schema, bukan sebaliknya: schema adalah sumber kebenaran
-- (AGENTS.md §3), dan ~30 tabel lain memang tidak memakai default database
-- untuk kolom-kolom seperti ini.
--
-- Aman karena Prisma selalu mengisi keduanya dari sisi klien: `@default(uuid())`
-- untuk id dan `@updatedAt` untuk updated_at, termasuk saat baris dibuat.
-- Tidak ada INSERT mentah ke tabel-tabel ini yang mengandalkan default tersebut.

-- AlterTable
ALTER TABLE "access_tiers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "registration_orders" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_webhook_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_preferences" ALTER COLUMN "updated_at" DROP DEFAULT;
