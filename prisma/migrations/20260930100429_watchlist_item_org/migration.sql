/*
  Warnings:

  - Added the required column `organizationId` to the `WatchlistItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WatchlistItem" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "WatchlistItem_organizationId_idx" ON "WatchlistItem"("organizationId");

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
