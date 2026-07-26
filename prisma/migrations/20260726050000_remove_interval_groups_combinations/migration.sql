-- Drop tables for interval rules, role combinations, and member groups.
-- Generation now uses preference + equity only; stacking/interval/groups are manual.

DROP TABLE IF EXISTS "GroupMembership";
DROP TABLE IF EXISTS "MemberGroup";
DROP TABLE IF EXISTS "MembershipRoleCombination";
DROP TABLE IF EXISTS "IntervalRule";

DROP TYPE IF EXISTS "GroupMode";
DROP TYPE IF EXISTS "IntervalCountMode";
