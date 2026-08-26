-- Committee seats: four offices hold one person, two hold many.
--
-- The old @@unique([position, isCurrent]) capped EVERY position at one sitting
-- holder, which made a committee of one committee member and one advisor. It is
-- replaced by a single nullable key that encodes which rule applies:
--
--   "PRESIDENT"                    single seat  -> a second sitting one collides
--   "COMMITTEE_MEMBER:<memberId>"  multi seat   -> distinct per holder
--   NULL                           retired      -> NULLs never collide
--
-- Backfill runs BEFORE the unique index is added, so a pre-existing duplicate
-- would fail the migration loudly rather than silently dropping a term.

-- 1. New column.
ALTER TABLE "OfficeTerm" ADD COLUMN "currentSeat" TEXT;

-- 2. Backfill from the boolean being retired. Only rows where isCurrent = true
--    were sitting; everything else (false or NULL) stays NULL.
UPDATE "OfficeTerm"
SET "currentSeat" = CASE
    WHEN "position" IN ('PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER')
      THEN "position"::TEXT
    ELSE "position"::TEXT || ':' || "memberId"
  END
WHERE "isCurrent" = TRUE;

-- 3. Drop the old constraint and the column it was built on.
DROP INDEX IF EXISTS "OfficeTerm_position_isCurrent_key";
ALTER TABLE "OfficeTerm" DROP COLUMN "isCurrent";

-- 4. The new rule. Fails here if the backfill produced a duplicate, which would
--    mean the old data already held two sitting holders of one single seat.
CREATE UNIQUE INDEX "OfficeTerm_currentSeat_key" ON "OfficeTerm"("currentSeat");

-- 5. Position is filtered on for the board and per-office history.
CREATE INDEX "OfficeTerm_position_idx" ON "OfficeTerm"("position");
