ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS spirit_energy INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'character_cultivation_spirit_energy_nonnegative'
  ) THEN
    ALTER TABLE character_cultivation
      ADD CONSTRAINT character_cultivation_spirit_energy_nonnegative
      CHECK (spirit_energy >= 0);
  END IF;
END $$;

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS breakthrough_preparation_state JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS technique_slots JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS pill_counters JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS pill_buffs JSONB NOT NULL DEFAULT '[]'::jsonb;
