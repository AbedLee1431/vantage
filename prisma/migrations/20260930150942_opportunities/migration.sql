-- CreateEnum
CREATE TYPE "OpportunityConfidence" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('open', 'archived');

-- AlterEnum
ALTER TYPE "AiAnalysisKind" ADD VALUE 'review_summary';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'review_summary';
ALTER TYPE "JobType" ADD VALUE 'opportunity_analysis';

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "supportingData" JSONB NOT NULL,
    "competitors" JSONB NOT NULL,
    "painPoints" JSONB NOT NULL,
    "differentiation" TEXT NOT NULL,
    "confidence" "OpportunityConfidence" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'open',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provenance" "Provenance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_idx" ON "Opportunity"("organizationId");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_status_idx" ON "Opportunity"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_confidence_idx" ON "Opportunity"("organizationId", "confidence");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
