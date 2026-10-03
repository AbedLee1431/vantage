-- CreateEnum
CREATE TYPE "AiAnalysisKind" AS ENUM ('ad', 'competitor');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ad_analysis', 'competitor_analysis');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "AiAnalysisKind" NOT NULL,
    "targetRef" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provenance" "Provenance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "evidence" JSONB,
    "provenance" "Provenance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "payload" JSONB NOT NULL,
    "resultId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAnalysis_organizationId_idx" ON "AiAnalysis"("organizationId");

-- CreateIndex
CREATE INDEX "AiAnalysis_organizationId_kind_targetRef_idx" ON "AiAnalysis"("organizationId", "kind", "targetRef");

-- CreateIndex
CREATE INDEX "AiAnalysis_organizationId_promptHash_idx" ON "AiAnalysis"("organizationId", "promptHash");

-- CreateIndex
CREATE INDEX "AiConversation_organizationId_idx" ON "AiConversation"("organizationId");

-- CreateIndex
CREATE INDEX "AiConversation_organizationId_updatedAt_idx" ON "AiConversation"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_idx" ON "AiMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_organizationId_idx" ON "Job"("organizationId");

-- CreateIndex
CREATE INDEX "Job_organizationId_status_idx" ON "Job"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Job_organizationId_type_status_idx" ON "Job"("organizationId", "type", "status");

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
