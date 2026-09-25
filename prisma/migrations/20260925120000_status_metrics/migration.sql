-- Status dashboard (2026-09-25): hourly API metrics + backup run log. Purely additive.

-- CreateTable
CREATE TABLE "ApiMetricHour" (
    "hour" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "totalMs" INTEGER NOT NULL DEFAULT 0,
    "maxMs" INTEGER NOT NULL DEFAULT 0,
    "dbQueries" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiMetricHour_pkey" PRIMARY KEY ("hour")
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" SERIAL NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file" TEXT NOT NULL,
    "sizeKb" DOUBLE PRECISION NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "rows" INTEGER NOT NULL,
    "host" TEXT,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);
