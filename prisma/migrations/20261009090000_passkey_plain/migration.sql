-- AlterTable: add plain-text passkey column for admin visibility
ALTER TABLE "user_passkeys" ADD COLUMN IF NOT EXISTS "passkey_plain" TEXT;
