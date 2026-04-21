CREATE TABLE IF NOT EXISTS players (
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
  CONSTRAINT players_guild_user_unique UNIQUE (guild_id, user_id),
  CONSTRAINT players_cash_nonnegative CHECK (cash >= 0),
  CONSTRAINT players_bank_nonnegative CHECK (bank >= 0),
  CONSTRAINT players_debt_nonnegative CHECK (debt >= 0)
);

CREATE INDEX IF NOT EXISTS players_guild_user_idx
  ON players (guild_id, user_id);

CREATE INDEX IF NOT EXISTS players_guild_cash_idx
  ON players (guild_id, cash DESC);

CREATE INDEX IF NOT EXISTS players_guild_bank_idx
  ON players (guild_id, bank DESC);

CREATE INDEX IF NOT EXISTS players_guild_debt_idx
  ON players (guild_id, debt DESC);

CREATE INDEX IF NOT EXISTS players_guild_net_worth_idx
  ON players (guild_id, net_worth DESC);

CREATE TABLE IF NOT EXISTS lakes (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  last_stocked TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lake_fish_stock (
  lake_id BIGINT NOT NULL REFERENCES lakes(id) ON DELETE CASCADE,
  fish_type TEXT NOT NULL,
  count INTEGER NOT NULL,
  reward INTEGER NOT NULL,
  CONSTRAINT lake_fish_stock_unique UNIQUE (lake_id, fish_type),
  CONSTRAINT lake_fish_stock_count_nonnegative CHECK (count >= 0)
);

CREATE TABLE IF NOT EXISTS economy_ledger (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  actor_user_id TEXT NULL,
  target_user_id TEXT NULL,
  event_type TEXT NOT NULL,
  delta_cash BIGINT NOT NULL DEFAULT 0,
  delta_bank BIGINT NOT NULL DEFAULT 0,
  delta_debt BIGINT NOT NULL DEFAULT 0,
  dedupe_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_bank_preferences (
  user_id TEXT PRIMARY KEY,
  active_bank TEXT NOT NULL DEFAULT 'heavenly-accord',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_bank_preferences_active_bank_check
    CHECK (active_bank IN (
      'heavenly-accord',
      'nine-abyss',
      'golden-abacus'
    ))
);

CREATE INDEX IF NOT EXISTS player_bank_preferences_active_bank_idx
  ON player_bank_preferences (active_bank);

CREATE TABLE IF NOT EXISTS player_credit_profiles (
  user_id TEXT PRIMARY KEY,
  bureau_score INTEGER NOT NULL DEFAULT 650,
  payment_history INTEGER NOT NULL DEFAULT 0,
  utilization INTEGER NOT NULL DEFAULT 0,
  credit_length INTEGER NOT NULL DEFAULT 0,
  new_credit INTEGER NOT NULL DEFAULT 0,
  credit_mix INTEGER NOT NULL DEFAULT 0,
  delinquency INTEGER NOT NULL DEFAULT 0,
  foreclosures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_credit_profiles_bureau_score_check
    CHECK (bureau_score BETWEEN 300 AND 850)
);

CREATE INDEX IF NOT EXISTS player_credit_profiles_bureau_score_idx
  ON player_credit_profiles (bureau_score DESC);

CREATE TABLE IF NOT EXISTS player_loans (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  principal BIGINT NOT NULL DEFAULT 0,
  current_balance BIGINT NOT NULL DEFAULT 0,
  interest_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
  estimated_term_months INTEGER NOT NULL DEFAULT 0,
  bureau_score INTEGER NOT NULL DEFAULT 0,
  approval_score INTEGER NOT NULL DEFAULT 0,
  credit_band TEXT NOT NULL DEFAULT 'legacy',
  collateral_requirement BIGINT NOT NULL DEFAULT 0,
  loan_state TEXT NOT NULL DEFAULT 'active',
  quoted_at TIMESTAMPTZ NULL,
  approved_at TIMESTAMPTZ NULL,
  activated_at TIMESTAMPTZ NULL,
  late_at TIMESTAMPTZ NULL,
  delinquent_at TIMESTAMPTZ NULL,
  foreclosure_warning_at TIMESTAMPTZ NULL,
  foreclosed_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_loans_state_check
    CHECK (loan_state IN (
      'quoted',
      'approved',
      'active',
      'late',
      'delinquent',
      'foreclosure warning',
      'foreclosed',
      'closed'
    )),
  CONSTRAINT player_loans_principal_nonnegative CHECK (principal >= 0),
  CONSTRAINT player_loans_balance_nonnegative CHECK (current_balance >= 0),
  CONSTRAINT player_loans_interest_nonnegative CHECK (interest_rate >= 0),
  CONSTRAINT player_loans_term_nonnegative CHECK (estimated_term_months >= 0),
  CONSTRAINT player_loans_bureau_score_nonnegative CHECK (bureau_score >= 0),
  CONSTRAINT player_loans_approval_score_nonnegative CHECK (approval_score >= 0),
  CONSTRAINT player_loans_collateral_nonnegative CHECK (collateral_requirement >= 0)
);

CREATE INDEX IF NOT EXISTS player_loans_user_guild_state_idx
  ON player_loans (user_id, guild_id, loan_state);

CREATE INDEX IF NOT EXISTS player_loans_guild_state_idx
  ON player_loans (guild_id, loan_state);

CREATE UNIQUE INDEX IF NOT EXISTS player_loans_open_contract_idx
  ON player_loans (user_id, guild_id)
  WHERE loan_state IN (
    'quoted',
    'approved',
    'active',
    'late',
    'delinquent',
    'foreclosure warning'
  );
