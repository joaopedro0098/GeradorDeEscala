-- CreateTable
CREATE TABLE "MembershipRoleCombination" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "roleAId" TEXT NOT NULL,
    "roleBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipRoleCombination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipRoleCombination_membershipId_idx" ON "MembershipRoleCombination"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRoleCombination_membershipId_roleAId_roleBId_key" ON "MembershipRoleCombination"("membershipId", "roleAId", "roleBId");

-- AddForeignKey
ALTER TABLE "MembershipRoleCombination" ADD CONSTRAINT "MembershipRoleCombination_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRoleCombination" ADD CONSTRAINT "MembershipRoleCombination_roleAId_fkey" FOREIGN KEY ("roleAId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRoleCombination" ADD CONSTRAINT "MembershipRoleCombination_roleBId_fkey" FOREIGN KEY ("roleBId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
