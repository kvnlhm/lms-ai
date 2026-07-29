-- CreateEnum
CREATE TYPE "CredentialTokenPurpose" AS ENUM ('INVITATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "MfaMethodType" AS ENUM ('TOTP');

-- DropIndex
DROP INDEX "password_reset_tokens_user_id_idx";

-- AlterTable
ALTER TABLE "password_reset_tokens" ADD COLUMN     "purpose" "CredentialTokenPurpose" NOT NULL DEFAULT 'PASSWORD_RESET';

-- CreateTable
CREATE TABLE "mfa_methods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "MfaMethodType" NOT NULL DEFAULT 'TOTP',
    "encrypted_secret" BYTEA NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mfa_methods_user_id_type_key" ON "mfa_methods"("user_id", "type");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_purpose_idx" ON "password_reset_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "mfa_methods" ADD CONSTRAINT "mfa_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
