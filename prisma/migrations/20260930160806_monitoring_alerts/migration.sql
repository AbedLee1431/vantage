-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('low', 'medium', 'high');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'catalog_sync';

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "changeEventId" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Alert_changeEventId_key" ON "Alert"("changeEventId");

-- CreateIndex
CREATE INDEX "Alert_organizationId_idx" ON "Alert"("organizationId");

-- CreateIndex
CREATE INDEX "Alert_organizationId_acknowledgedAt_idx" ON "Alert"("organizationId", "acknowledgedAt");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_changeEventId_fkey" FOREIGN KEY ("changeEventId") REFERENCES "ChangeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
