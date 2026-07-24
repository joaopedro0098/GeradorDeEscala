-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN "hasPendingDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Schedule" ADD COLUMN "publishedSnapshotId" TEXT;

-- CreateTable
CREATE TABLE "SchedulePreviousVersion" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAtSave" "ScheduleStatus" NOT NULL,
    "generationStatus" "ScheduleGenerationStatus",
    "hasPublishedGaps" BOOLEAN NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "SchedulePreviousVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePreviousVersionSlot" (
    "id" TEXT NOT NULL,
    "previousId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "membershipId" TEXT,
    "isManual" BOOLEAN NOT NULL,
    "isMinister" BOOLEAN NOT NULL,

    CONSTRAINT "SchedulePreviousVersionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePublishedSnapshot" (
    "id" TEXT NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationStatus" "ScheduleGenerationStatus",
    "hasPublishedGaps" BOOLEAN NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "SchedulePublishedSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePublishedSnapshotSlot" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "membershipId" TEXT,
    "isManual" BOOLEAN NOT NULL,
    "isMinister" BOOLEAN NOT NULL,

    CONSTRAINT "SchedulePublishedSnapshotSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePreviousVersion_scheduleId_key" ON "SchedulePreviousVersion"("scheduleId");

-- CreateIndex
CREATE INDEX "SchedulePreviousVersionSlot_previousId_idx" ON "SchedulePreviousVersionSlot"("previousId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePreviousVersionSlot_previousId_eventId_roleId_slotIndex_key" ON "SchedulePreviousVersionSlot"("previousId", "eventId", "roleId", "slotIndex");

-- CreateIndex
CREATE INDEX "SchedulePublishedSnapshotSlot_snapshotId_idx" ON "SchedulePublishedSnapshotSlot"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePublishedSnapshotSlot_snapshotId_eventId_roleId_slotIndex_key" ON "SchedulePublishedSnapshotSlot"("snapshotId", "eventId", "roleId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_publishedSnapshotId_key" ON "Schedule"("publishedSnapshotId");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_publishedSnapshotId_fkey" FOREIGN KEY ("publishedSnapshotId") REFERENCES "SchedulePublishedSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePreviousVersion" ADD CONSTRAINT "SchedulePreviousVersion_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePreviousVersionSlot" ADD CONSTRAINT "SchedulePreviousVersionSlot_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "SchedulePreviousVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePublishedSnapshotSlot" ADD CONSTRAINT "SchedulePublishedSnapshotSlot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SchedulePublishedSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
