-- CreateTable
CREATE TABLE "SyncState" (
    "organizationId" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
