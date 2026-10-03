/*
  Warnings:

  - Added the required column `organizationId` to the `AiMessage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AiMessage" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "AiMessage_organizationId_idx" ON "AiMessage"("organizationId");

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
