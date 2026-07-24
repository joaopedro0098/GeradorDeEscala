-- CreateEnum
CREATE TYPE "GroupMode" AS ENUM ('FLEXIBLE', 'STRICT');

-- CreateTable
CREATE TABLE "MemberGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "GroupMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberGroup_organizationId_idx" ON "MemberGroup"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberGroup_organizationId_name_key" ON "MemberGroup"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_membershipId_key" ON "GroupMembership"("membershipId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- AddForeignKey
ALTER TABLE "MemberGroup" ADD CONSTRAINT "MemberGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MemberGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
