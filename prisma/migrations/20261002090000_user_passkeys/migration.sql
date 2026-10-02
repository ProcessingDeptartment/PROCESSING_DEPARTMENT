-- Admin-managed numeric passkeys (signature PINs) and their usage log.
CREATE TABLE "user_passkeys" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passkey" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "user_passkeys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_passkeys_username_key" ON "user_passkeys"("username");

CREATE TABLE "passkey_logs" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "recordKey" TEXT,
    "recordId" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkey_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "passkey_logs_username_verifiedAt_idx" ON "passkey_logs"("username", "verifiedAt");
