-- Add patternSeed column to Group table for deterministic SVG pattern generation.
-- Existing groups get a random seed; new groups get one via DEFAULT.
ALTER TABLE "Group"
  ADD COLUMN "patternSeed" integer NOT NULL DEFAULT floor(random() * 2147483647);
