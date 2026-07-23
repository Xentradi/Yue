const { Pool, types } = require('pg');
const { performance } = require('node:perf_hooks');
const { logDuration } = require('../utils/profiling');
const { ensureCultivationSchema } = require('./cultivationSchema');

const APP_SCHEMA_NAMESPACE = 'core';
const APP_SCHEMA_VERSION = 2;
const INT8_OID = 20;
const NUMERIC_OID = 1700;

types.setTypeParser(INT8_OID, (value) => {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
});

types.setTypeParser(NUMERIC_OID, (value) => {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
});

let pool;
let schemaReadyPromise;

function getDatabaseUrl() {
  const databaseUrl = process.env.DB_URL?.trim() || '';

  if (!databaseUrl) {
    throw new Error('Missing required database connection string in DB_URL.');
  }

  return databaseUrl;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return pool;
}

function describeQueryLabel(text) {
  const operation = text.trimStart().split(/\s+/)[0]?.toUpperCase() ?? 'QUERY';
  const normalizedText = text.toLowerCase();

  if (
    normalizedText.includes(' for update') ||
    normalizedText.includes(' for share') ||
    normalizedText.includes(' for no key update') ||
    normalizedText.includes(' for key share') ||
    normalizedText.includes(' lock in share mode')
  ) {
    return `LOCK ${operation}`;
  }

  return operation;
}

function describeQueryDetail(text, rowCount = 0) {
  const details = [`rows=${rowCount ?? 0}`];
  const lockMatch = text.match(
    /\bFOR\s+(UPDATE|NO KEY UPDATE|SHARE|KEY SHARE)\b/i,
  );

  if (lockMatch) {
    details.push(`lock=${lockMatch[1].toLowerCase().replace(/\s+/g, '-')}`);
  }

  return details.join(' ');
}

async function timedConnect(detail = '') {
  const startedAt = performance.now();
  const client = await getPool().connect();
  logDuration(
    'db',
    'CONNECT',
    Math.round(performance.now() - startedAt),
    detail,
  );
  return client;
}

async function query(text, values = []) {
  const operation = describeQueryLabel(text);
  const client = await timedConnect(`operation=${operation}`);
  try {
    const startedAt = performance.now();
    const result = await client.query(text, values);
    logDuration(
      'db',
      operation,
      Math.round(performance.now() - startedAt),
      describeQueryDetail(text, result.rowCount),
    );
    return result;
  } finally {
    client.release();
  }
}

async function schemaVersionTableExists() {
  const result = await query(
    `
      SELECT to_regclass('public.app_schema_versions') IS NOT NULL AS exists;
    `,
  );

  return Boolean(result.rows[0]?.exists);
}

async function getSchemaVersion(namespace) {
  if (!(await schemaVersionTableExists())) {
    return null;
  }

  const result = await query(
    `
      SELECT version
      FROM app_schema_versions
      WHERE namespace = $1
      LIMIT 1;
    `,
    [namespace],
  );

  return result.rows[0]?.version ?? null;
}

async function ensureSchemaVersionTable() {
  if (await schemaVersionTableExists()) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS app_schema_versions (
      namespace TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function setSchemaVersion(namespace, version) {
  await ensureSchemaVersionTable();
  await query(
    `
      INSERT INTO app_schema_versions (namespace, version, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (namespace) DO UPDATE SET
        version = EXCLUDED.version,
        updated_at = NOW();
    `,
    [namespace, version],
  );
}

async function withTransaction(callback) {
  const startedAt = performance.now();
  const client = await timedConnect('transaction');
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    logDuration(
      'db',
      'TRANSACTION',
      Math.round(performance.now() - startedAt),
      'committed',
    );
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures so the original error is preserved.
    }
    logDuration(
      'db',
      'TRANSACTION',
      Math.round(performance.now() - startedAt),
      'rolled back',
      {
        force: true,
        level: 'warn',
      },
    );
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const schemaVersion = await getSchemaVersion(APP_SCHEMA_NAMESPACE);
      if (schemaVersion !== null && schemaVersion >= APP_SCHEMA_VERSION) {
        return;
      }

      await ensureCultivationSchema({ query });

      await query(`
        CREATE TABLE IF NOT EXISTS lakes (
          id BIGSERIAL PRIMARY KEY,
          guild_id TEXT NOT NULL UNIQUE,
          ownership_type TEXT NOT NULL DEFAULT 'public',
          last_stocked TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        ALTER TABLE lakes
          ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'public';
      `);

      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'lakes_ownership_type_check'
          ) THEN
            ALTER TABLE lakes
              ADD CONSTRAINT lakes_ownership_type_check
              CHECK (ownership_type IN ('public', 'clan'));
          END IF;
        END $$;
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS lake_fish_stock (
          lake_id BIGINT NOT NULL REFERENCES lakes(id) ON DELETE CASCADE,
          fish_type TEXT NOT NULL,
          count INTEGER NOT NULL,
          reward INTEGER NOT NULL,
          CONSTRAINT lake_fish_stock_unique UNIQUE (lake_id, fish_type),
          CONSTRAINT lake_fish_stock_count_nonnegative CHECK (count >= 0)
        );
      `);

      await query(`
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
      `);

      await query(`
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
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS player_bank_preferences_active_bank_idx
          ON player_bank_preferences (active_bank);
      `);

      await query(`
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
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS player_credit_profiles_bureau_score_idx
          ON player_credit_profiles (bureau_score DESC);
      `);

      await query(`
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
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS player_loans_user_guild_state_idx
          ON player_loans (user_id, guild_id, loan_state);
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS player_loans_guild_state_idx
          ON player_loans (guild_id, loan_state);
      `);

      await query(`
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
      `);

      await setSchemaVersion(APP_SCHEMA_NAMESPACE, APP_SCHEMA_VERSION);
    })();
  }

  return schemaReadyPromise;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
    schemaReadyPromise = undefined;
  }
}

module.exports = {
  describeQueryDetail,
  ensureSchema,
  describeQueryLabel,
  getPool,
  query,
  withTransaction,
  closePool,
};
