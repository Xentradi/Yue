const { query, withTransaction } = require('./postgres');

const DEFAULT_ACTIVE_BANK = 'heavenly-accord';
const VALID_ACTIVE_BANKS = new Set([
  'heavenly-accord',
  'nine-abyss',
  'golden-abacus',
]);

function normalizeBankPreferenceRow(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    activeBank: row.active_bank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isValidBankId(bankId) {
  return VALID_ACTIVE_BANKS.has(bankId);
}

async function getBankPreference(userId, options = {}) {
  if (!userId) {
    return null;
  }

  const runner = options.client ?? { query };
  const result = await runner.query(
    `
      SELECT user_id, active_bank, created_at, updated_at
      FROM player_bank_preferences
      WHERE user_id = $1
      LIMIT 1;
    `,
    [userId],
  );

  return normalizeBankPreferenceRow(result.rows[0] ?? null);
}

async function ensureBankPreference(
  userId,
  activeBank = DEFAULT_ACTIVE_BANK,
  options = {},
) {
  if (!userId) {
    return null;
  }

  const normalizedBank = isValidBankId(activeBank)
    ? activeBank
    : DEFAULT_ACTIVE_BANK;
  const runner = options.client ?? { query };

  await runner.query(
    `
      INSERT INTO player_bank_preferences (user_id, active_bank)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO NOTHING;
    `,
    [userId, normalizedBank],
  );

  return await getBankPreference(userId, options);
}

async function setBankPreference(userId, activeBank, options = {}) {
  if (!userId) {
    return null;
  }

  if (!isValidBankId(activeBank)) {
    return null;
  }

  const runner = options.client ?? { query };
  const result = await runner.query(
    `
      INSERT INTO player_bank_preferences (user_id, active_bank)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        active_bank = EXCLUDED.active_bank,
        updated_at = NOW()
      RETURNING user_id, active_bank, created_at, updated_at;
    `,
    [userId, activeBank],
  );

  return normalizeBankPreferenceRow(result.rows[0] ?? null);
}

async function replaceBankPreference(userId, activeBank, options = {}) {
  return await withTransaction(async (client) => {
    return await setBankPreference(userId, activeBank, {
      ...options,
      client,
    });
  });
}

module.exports = {
  DEFAULT_ACTIVE_BANK,
  VALID_ACTIVE_BANKS,
  ensureBankPreference,
  getBankPreference,
  isValidBankId,
  replaceBankPreference,
  setBankPreference,
};
