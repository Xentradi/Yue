DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'players'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'player_economy'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'guild_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'discord_user_id'
  ) THEN
    ALTER TABLE IF EXISTS players RENAME TO player_economy;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS player_economy (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  exp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  cash BIGINT NOT NULL DEFAULT 0,
  bank BIGINT NOT NULL DEFAULT 0,
  debt BIGINT NOT NULL DEFAULT 0,
  reputation INTEGER NOT NULL DEFAULT 0,
  relationship INTEGER NOT NULL DEFAULT 0,
  exp_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
  cash_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
  interest_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
  last_daily_bonus_claim TIMESTAMPTZ NULL,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  net_worth BIGINT GENERATED ALWAYS AS ((cash + bank) - debt) STORED,
  CONSTRAINT player_economy_guild_user_unique UNIQUE (guild_id, user_id),
  CONSTRAINT player_economy_cash_nonnegative CHECK (cash >= 0),
  CONSTRAINT player_economy_bank_nonnegative CHECK (bank >= 0),
  CONSTRAINT player_economy_debt_nonnegative CHECK (debt >= 0)
);

CREATE INDEX IF NOT EXISTS player_economy_guild_user_idx
  ON player_economy (guild_id, user_id);

CREATE INDEX IF NOT EXISTS player_economy_guild_cash_idx
  ON player_economy (guild_id, cash DESC);

CREATE INDEX IF NOT EXISTS player_economy_guild_bank_idx
  ON player_economy (guild_id, bank DESC);

CREATE INDEX IF NOT EXISTS player_economy_guild_debt_idx
  ON player_economy (guild_id, debt DESC);

CREATE INDEX IF NOT EXISTS player_economy_guild_net_worth_idx
  ON player_economy (guild_id, net_worth DESC);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS background_definitions (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  physique_mod INTEGER NOT NULL DEFAULT 0,
  comprehension_mod INTEGER NOT NULL DEFAULT 0,
  spirit_mod INTEGER NOT NULL DEFAULT 0,
  fortune_mod INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS realm_definitions (
  realm_index INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  stage_max INTEGER NOT NULL DEFAULT 9,
  base_lifespan_bonus INTEGER NOT NULL DEFAULT 0,
  has_tribulation BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY,
  player_id UUID NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sex TEXT NULL,
  age INTEGER NOT NULL DEFAULT 0,
  lifespan_max INTEGER NOT NULL DEFAULT 0,
  background_id UUID NULL REFERENCES background_definitions(id) ON DELETE SET NULL,
  alignment TEXT NOT NULL DEFAULT 'neutral',
  virtue INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL DEFAULT 'balanced',
  dao_focus TEXT NULL,
  current_title_id UUID NULL,
  current_region_id UUID NULL,
  current_location_id UUID NULL,
  is_alive BOOLEAN NOT NULL DEFAULT TRUE,
  is_sealed BOOLEAN NOT NULL DEFAULT FALSE,
  is_missing BOOLEAN NOT NULL DEFAULT FALSE,
  is_retired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT characters_alignment_check
    CHECK (alignment IN ('righteous', 'neutral', 'demonic')),
  CONSTRAINT characters_path_check
    CHECK (path IN ('body', 'qi', 'balanced')),
  CONSTRAINT characters_age_nonnegative CHECK (age >= 0),
  CONSTRAINT characters_lifespan_nonnegative CHECK (lifespan_max >= 0),
  CONSTRAINT characters_virtue_nonnegative CHECK (virtue >= 0)
);

CREATE TABLE IF NOT EXISTS character_attributes (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  physique INTEGER NOT NULL DEFAULT 0,
  comprehension INTEGER NOT NULL DEFAULT 0,
  spirit INTEGER NOT NULL DEFAULT 0,
  fortune INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_attributes_physique_nonnegative CHECK (physique >= 0),
  CONSTRAINT character_attributes_comprehension_nonnegative CHECK (comprehension >= 0),
  CONSTRAINT character_attributes_spirit_nonnegative CHECK (spirit >= 0),
  CONSTRAINT character_attributes_fortune_nonnegative CHECK (fortune >= 0)
);

CREATE TABLE IF NOT EXISTS character_talent (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  root_type TEXT NOT NULL DEFAULT 'unknown',
  root_quality INTEGER NOT NULL DEFAULT 0,
  special_constitution TEXT NULL,
  affinity_primary TEXT NULL,
  affinity_secondary TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_talent_root_quality_nonnegative CHECK (root_quality >= 0)
);

CREATE TABLE IF NOT EXISTS character_cultivation (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  realm_index INTEGER NOT NULL REFERENCES realm_definitions(realm_index),
  stage INTEGER NOT NULL DEFAULT 0,
  stage_progress INTEGER NOT NULL DEFAULT 0,
  cultivation_base INTEGER NOT NULL DEFAULT 0,
  qi_current INTEGER NOT NULL DEFAULT 0,
  qi_quality INTEGER NOT NULL DEFAULT 0,
  foundation_quality INTEGER NOT NULL DEFAULT 0,
  last_progress_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_breakthrough_at TIMESTAMPTZ NULL,
  meditation_started_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_cultivation_stage_nonnegative CHECK (stage >= 0),
  CONSTRAINT character_cultivation_stage_progress_nonnegative CHECK (stage_progress >= 0),
  CONSTRAINT character_cultivation_cultivation_base_nonnegative CHECK (cultivation_base >= 0),
  CONSTRAINT character_cultivation_qi_current_nonnegative CHECK (qi_current >= 0),
  CONSTRAINT character_cultivation_qi_quality_nonnegative CHECK (qi_quality >= 0),
  CONSTRAINT character_cultivation_foundation_quality_nonnegative CHECK (foundation_quality >= 0)
);

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS last_breakthrough_at TIMESTAMPTZ NULL;

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS meditation_started_at TIMESTAMPTZ NULL;

ALTER TABLE character_cultivation
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS character_status (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  hp_current INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'stable',
  state TEXT NOT NULL DEFAULT 'idle',
  meridian_state TEXT NOT NULL DEFAULT 'stable',
  dantian_state TEXT NOT NULL DEFAULT 'stable',
  mental_state TEXT NOT NULL DEFAULT 'calm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_status_hp_nonnegative CHECK (hp_current >= 0),
  CONSTRAINT character_status_condition_check
    CHECK (condition IN ('stable', 'strained', 'injured', 'recovering', 'crippled')),
  CONSTRAINT character_status_state_check
    CHECK (state IN ('idle', 'cultivating', 'breakthrough', 'recovering', 'injured')),
  CONSTRAINT character_status_meridian_state_check
    CHECK (meridian_state IN ('stable', 'strained', 'damaged', 'blocked')),
  CONSTRAINT character_status_dantian_state_check
    CHECK (dantian_state IN ('stable', 'strained', 'damaged', 'cracked')),
  CONSTRAINT character_status_mental_state_check
    CHECK (mental_state IN ('calm', 'focused', 'shaken', 'unstable'))
);

INSERT INTO realm_definitions (
  realm_index,
  name,
  stage_max,
  base_lifespan_bonus,
  has_tribulation
)
VALUES
  (1, 'Body Refinement', 9, 0, FALSE),
  (2, 'Qi Gathering', 9, 0, FALSE),
  (3, 'Foundation Establishment', 9, 0, FALSE),
  (4, 'Golden Core', 9, 0, FALSE),
  (5, 'Nascent Soul', 9, 0, FALSE),
  (6, 'Soul Formation', 9, 0, FALSE),
  (7, 'Body Integration', 9, 0, FALSE),
  (8, 'Tribulation Transcendence', 9, 0, FALSE),
  (9, 'Enlightenment', 9, 0, FALSE)
ON CONFLICT (realm_index) DO UPDATE SET
  name = EXCLUDED.name,
  stage_max = EXCLUDED.stage_max,
  base_lifespan_bonus = EXCLUDED.base_lifespan_bonus,
  has_tribulation = EXCLUDED.has_tribulation;

INSERT INTO background_definitions (
  id,
  key,
  name,
  description,
  physique_mod,
  comprehension_mod,
  spirit_mod,
  fortune_mod
)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'commoner', 'Village Commoner', 'A hard-lived commoner with steady survival instincts.', 1, 0, 0, 0),
  ('22222222-2222-2222-2222-222222222222', 'scholar', 'Scholarly Aptitude', 'Raised on books and learning, but not on hardship.', -1, 2, 1, 0),
  ('33333333-3333-3333-3333-333333333333', 'merchant', 'Merchant Lineage', 'Used to trade routes, bargains, and precarious luck.', 0, 1, 0, 2),
  ('44444444-4444-4444-4444-444444444444', 'noble', 'Noble House', 'An upbringing of resources, etiquette, and cultivation tutors.', 0, 1, 1, 1),
  ('55555555-5555-5555-5555-555555555555', 'sect-disciple', 'Sect Disciple', 'Formally trained within a sect and shaped by its discipline.', 1, 1, 1, -1),
  ('66666666-6666-6666-6666-666666666666', 'temple-orphan', 'Temple Orphan', 'Raised around incense, prayers, and quiet spiritual pressure.', 0, 1, 2, 0),
  ('77777777-7777-7777-7777-777777777777', 'hermit', 'Mountain Hermit', 'A solitary upbringing shaped by harsh mountains and stillness.', 1, 1, 1, 0),
  ('88888888-8888-8888-8888-888888888888', 'battlefield-survivor', 'Battlefield Survivor', 'Survived violence early and learned to endure through it.', 2, 0, 1, -1),
  ('99999999-9999-9999-9999-999999999999', 'demonic-outcast', 'Demonic Outcast', 'Marked by dangerous luck and a harsh road outside the norm.', 1, 0, 1, 1)
ON CONFLICT (id) DO UPDATE SET
  key = EXCLUDED.key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  physique_mod = EXCLUDED.physique_mod,
  comprehension_mod = EXCLUDED.comprehension_mod,
  spirit_mod = EXCLUDED.spirit_mod,
  fortune_mod = EXCLUDED.fortune_mod;
