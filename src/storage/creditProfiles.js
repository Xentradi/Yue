const { query } = require('./postgres');

const DEFAULT_BUREAU_SCORE = 650;

function clampScore(score) {
  if (!Number.isFinite(score)) {
    return DEFAULT_BUREAU_SCORE;
  }

  return Math.min(850, Math.max(300, Math.trunc(score)));
}

function normalizeCreditProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    bureauScore: row.bureau_score,
    paymentHistory: row.payment_history,
    utilization: row.utilization,
    creditLength: row.credit_length,
    newCredit: row.new_credit,
    creditMix: row.credit_mix,
    delinquency: row.delinquency,
    foreclosures: row.foreclosures,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCreditProfile(userId, options = {}) {
  if (!userId) {
    return null;
  }

  const runner = options.client ?? { query };
  const result = await runner.query(
    `
      SELECT *
      FROM player_credit_profiles
      WHERE user_id = $1
      LIMIT 1;
    `,
    [userId],
  );

  return normalizeCreditProfileRow(result.rows[0] ?? null);
}

async function ensureCreditProfile(userId, options = {}) {
  if (!userId) {
    return null;
  }

  const runner = options.client ?? { query };
  await runner.query(
    `
      INSERT INTO player_credit_profiles (
        user_id,
        bureau_score,
        payment_history,
        utilization,
        credit_length,
        new_credit,
        credit_mix,
        delinquency,
        foreclosures
      )
      VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;
    `,
    [userId, DEFAULT_BUREAU_SCORE],
  );

  return await getCreditProfile(userId, options);
}

async function setCreditProfile(userId, values, options = {}) {
  if (
    !userId ||
    !values ||
    typeof values !== 'object' ||
    Array.isArray(values)
  ) {
    return null;
  }

  const current = await ensureCreditProfile(userId, options);
  const next = {
    bureau_score: clampScore(values.bureauScore ?? current.bureauScore),
    payment_history: Number.isFinite(values.paymentHistory)
      ? Math.trunc(values.paymentHistory)
      : current.paymentHistory,
    utilization: Number.isFinite(values.utilization)
      ? Math.trunc(values.utilization)
      : current.utilization,
    credit_length: Number.isFinite(values.creditLength)
      ? Math.trunc(values.creditLength)
      : current.creditLength,
    new_credit: Number.isFinite(values.newCredit)
      ? Math.trunc(values.newCredit)
      : current.newCredit,
    credit_mix: Number.isFinite(values.creditMix)
      ? Math.trunc(values.creditMix)
      : current.creditMix,
    delinquency: Number.isFinite(values.delinquency)
      ? Math.trunc(values.delinquency)
      : current.delinquency,
    foreclosures: Number.isFinite(values.foreclosures)
      ? Math.trunc(values.foreclosures)
      : current.foreclosures,
  };

  const runner = options.client ?? { query };
  const result = await runner.query(
    `
      UPDATE player_credit_profiles
      SET
        bureau_score = $2,
        payment_history = $3,
        utilization = $4,
        credit_length = $5,
        new_credit = $6,
        credit_mix = $7,
        delinquency = $8,
        foreclosures = $9,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *;
    `,
    [
      userId,
      next.bureau_score,
      next.payment_history,
      next.utilization,
      next.credit_length,
      next.new_credit,
      next.credit_mix,
      next.delinquency,
      next.foreclosures,
    ],
  );

  return normalizeCreditProfileRow(result.rows[0] ?? null);
}

module.exports = {
  DEFAULT_BUREAU_SCORE,
  clampScore,
  ensureCreditProfile,
  getCreditProfile,
  setCreditProfile,
};
