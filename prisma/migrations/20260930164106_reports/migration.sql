-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('competitor', 'product', 'advertising', 'customer', 'trends', 'monitoring', 'combined');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'report_generation';

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'queued',
    "params" JSONB NOT NULL,
    "sections" JSONB,
    "evidence" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "provenance" "Provenance" NOT NULL DEFAULT 'demo',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_organizationId_idx" ON "Report"("organizationId");

-- CreateIndex
CREATE INDEX "Report_organizationId_type_idx" ON "Report"("organizationId", "type");

-- CreateIndex
CREATE INDEX "Report_organizationId_status_idx" ON "Report"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
