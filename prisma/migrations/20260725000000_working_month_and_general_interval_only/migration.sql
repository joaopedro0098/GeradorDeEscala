-- Working month shared by schedule, availability and the event calendar.
ALTER TABLE "Organization" ADD COLUMN "workingYear" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "workingMonth" INTEGER;

-- Per-role interval rules were removed: keep only the organization-wide rule.
DELETE FROM "IntervalRule" WHERE "scopeKey" <> 'GENERAL';

ALTER TABLE "IntervalRule" DROP CONSTRAINT IF EXISTS "IntervalRule_roleId_fkey";
DROP INDEX IF EXISTS "IntervalRule_organizationId_scopeKey_key";
DROP INDEX IF EXISTS "IntervalRule_organizationId_idx";

ALTER TABLE "IntervalRule" DROP COLUMN "roleId";
ALTER TABLE "IntervalRule" DROP COLUMN "scopeKey";

CREATE UNIQUE INDEX "IntervalRule_organizationId_key" ON "IntervalRule"("organizationId");
