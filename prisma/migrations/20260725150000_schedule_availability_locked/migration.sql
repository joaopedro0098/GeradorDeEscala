-- RenameTable column: invert product meaning — locked when true.
ALTER TABLE "Schedule" RENAME COLUMN "allowMemberEdits" TO "availabilityLocked";
