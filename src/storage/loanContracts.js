const { query } = require('./postgres');

const LOAN_STATES = Object.freeze({
  QUOTED: 'quoted',
  APPROVED: 'approved',
  ACTIVE: 'active',
  LATE: 'late',
  DELINQUENT: 'delinquent',
  FORECLOSURE_WARNING: 'foreclosure warning',
  FORECLOSED: 'foreclosed',
  CLOSED: 'closed',
});

const OPEN_LOAN_STATES = Object.freeze([
  LOAN_STATES.QUOTED,
  LOAN_STATES.APPROVED,
  LOAN_STATES.ACTIVE,
  LOAN_STATES.LATE,
  LOAN_STATES.DELINQUENT,
  LOAN_STATES.FORECLOSURE_WARNING,
]);

const STATE_TIMESTAMP_COLUMN = {
  [LOAN_STATES.QUOTED]: 'quoted_at',
  [LOAN_STATES.APPROVED]: 'approved_at',
  [LOAN_STATES.ACTIVE]: 'activated_at',
  [LOAN_STATES.LATE]: 'late_at',
  [LOAN_STATES.DELINQUENT]: 'delinquent_at',
  [LOAN_STATES.FORECLOSURE_WARNING]: 'foreclosure_warning_at',
  [LOAN_STATES.FORECLOSED]: 'foreclosed_at',
  [LOAN_STATES.CLOSED]: 'closed_at',
};

function isValidLoanState(state) {
  return Object.values(LOAN_STATES).includes(state);
}

function normalizeLoanContractRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    guildId: row.guild_id,
    bankId: row.bank_id,
    principal: row.principal,
    currentBalance: row.current_balance,
    interestRate: row.interest_rate,
    estimatedTermMonths: row.estimated_term_months,
    bureauScore: row.bureau_score,
    approvalScore: row.approval_score,
    creditBand: row.credit_band,
    collateralRequirement: row.collateral_requirement,
    state: row.loan_state,
    quotedAt: row.quoted_at,
    approvedAt: row.approved_at,
    activatedAt: row.activated_at,
    lateAt: row.late_at,
    delinquentAt: row.delinquent_at,
    foreclosureWarningAt: row.foreclosure_warning_at,
    foreclosedAt: row.foreclosed_at,
    closedAt: row.closed_at,
    metadata:
      row.metadata &&
      typeof row.metadata === 'object' &&
      !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveRunner(options = {}) {
  return options.client ?? { query };
}

function buildStateTimestamps(state, timestamp = new Date()) {
  const timestamps = {
    quoted_at: null,
    approved_at: null,
    activated_at: null,
    late_at: null,
    delinquent_at: null,
    foreclosure_warning_at: null,
    foreclosed_at: null,
    closed_at: null,
  };

  const column = STATE_TIMESTAMP_COLUMN[state];
  if (column) {
    timestamps[column] = timestamp;
  }

  return timestamps;
}

function normalizeNumeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWholeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

async function getLoanContractById(contractId, options = {}) {
  if (!contractId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM player_loans
      WHERE id = $1
      LIMIT 1;
    `,
    [contractId],
  );

  return normalizeLoanContractRow(result.rows[0] ?? null);
}

async function getOpenLoanContract(userId, guildId, options = {}) {
  if (!userId || !guildId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM player_loans
      WHERE user_id = $1
        AND guild_id = $2
        AND loan_state = ANY($3::text[])
      ORDER BY updated_at DESC, id DESC
      LIMIT 1;
    `,
    [userId, guildId, OPEN_LOAN_STATES],
  );

  return normalizeLoanContractRow(result.rows[0] ?? null);
}

async function listLoanContracts(userId, guildId, options = {}) {
  if (!userId || !guildId) {
    return [];
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM player_loans
      WHERE user_id = $1
        AND guild_id = $2
      ORDER BY created_at DESC, id DESC;
    `,
    [userId, guildId],
  );

  return result.rows.map((row) => normalizeLoanContractRow(row));
}

async function listOpenLoanContracts(options = {}) {
  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM player_loans
      WHERE loan_state = ANY($1::text[])
      ORDER BY updated_at ASC, id ASC;
    `,
    [OPEN_LOAN_STATES],
  );

  return result.rows.map((row) => normalizeLoanContractRow(row));
}

async function createLoanContract(contract, options = {}) {
  if (
    !contract ||
    !contract.userId ||
    !contract.guildId ||
    !contract.bankId ||
    !isValidLoanState(contract.state ?? LOAN_STATES.ACTIVE)
  ) {
    return null;
  }

  const runner = resolveRunner(options);
  const state = contract.state ?? LOAN_STATES.ACTIVE;
  const timestamps = buildStateTimestamps(state);
  const result = await runner.query(
    `
      INSERT INTO player_loans (
        user_id,
        guild_id,
        bank_id,
        principal,
        current_balance,
        interest_rate,
        estimated_term_months,
        bureau_score,
        approval_score,
        credit_band,
        collateral_requirement,
        loan_state,
        quoted_at,
        approved_at,
        activated_at,
        late_at,
        delinquent_at,
        foreclosure_warning_at,
        foreclosed_at,
        closed_at,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *;
    `,
    [
      contract.userId,
      contract.guildId,
      contract.bankId,
      normalizeWholeNumber(contract.principal, 0),
      normalizeWholeNumber(contract.currentBalance, 0),
      normalizeNumeric(contract.interestRate, 0),
      normalizeWholeNumber(contract.estimatedTermMonths, 0),
      normalizeWholeNumber(contract.bureauScore, 0),
      normalizeWholeNumber(contract.approvalScore, 0),
      String(contract.creditBand ?? 'legacy'),
      normalizeWholeNumber(contract.collateralRequirement, 0),
      state,
      timestamps.quoted_at,
      timestamps.approved_at,
      timestamps.activated_at,
      timestamps.late_at,
      timestamps.delinquent_at,
      timestamps.foreclosure_warning_at,
      timestamps.foreclosed_at,
      timestamps.closed_at,
      contract.metadata ?? {},
    ],
  );

  return normalizeLoanContractRow(result.rows[0] ?? null);
}

async function updateLoanContractState(contractId, state, options = {}) {
  if (!contractId || !isValidLoanState(state)) {
    return null;
  }

  const runner = resolveRunner(options);
  const timestamps = buildStateTimestamps(state);
  const result = await runner.query(
    `
      UPDATE player_loans
      SET
        loan_state = $2,
        quoted_at = COALESCE($3, quoted_at),
        approved_at = COALESCE($4, approved_at),
        activated_at = COALESCE($5, activated_at),
        late_at = COALESCE($6, late_at),
        delinquent_at = COALESCE($7, delinquent_at),
        foreclosure_warning_at = COALESCE($8, foreclosure_warning_at),
        foreclosed_at = COALESCE($9, foreclosed_at),
        closed_at = COALESCE($10, closed_at),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
    [
      contractId,
      state,
      timestamps.quoted_at,
      timestamps.approved_at,
      timestamps.activated_at,
      timestamps.late_at,
      timestamps.delinquent_at,
      timestamps.foreclosure_warning_at,
      timestamps.foreclosed_at,
      timestamps.closed_at,
    ],
  );

  return normalizeLoanContractRow(result.rows[0] ?? null);
}

async function updateLoanContractBalance(
  contractId,
  currentBalance,
  options = {},
) {
  if (!contractId) {
    return null;
  }

  const runner = resolveRunner(options);
  const normalizedBalance = Math.max(
    0,
    normalizeWholeNumber(currentBalance, 0),
  );
  const result = await runner.query(
    `
      UPDATE player_loans
      SET
        current_balance = $2::bigint,
        loan_state = CASE
          WHEN $2::bigint <= 0 THEN 'closed'
          ELSE loan_state
        END,
        closed_at = CASE
          WHEN $2::bigint <= 0 THEN COALESCE(closed_at, NOW())
          ELSE closed_at
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
    [contractId, normalizedBalance],
  );

  return normalizeLoanContractRow(result.rows[0] ?? null);
}

async function updateLoanContractStatus(
  contractId,
  state,
  currentBalance,
  options = {},
) {
  if (!contractId || !isValidLoanState(state)) {
    return null;
  }

  const runner = resolveRunner(options);
  const timestamps = buildStateTimestamps(state);
  const result = await runner.query(
    `
      UPDATE player_loans
      SET
        current_balance = COALESCE($3::bigint, current_balance),
        loan_state = $2,
        quoted_at = COALESCE($4, quoted_at),
        approved_at = COALESCE($5, approved_at),
        activated_at = COALESCE($6, activated_at),
        late_at = COALESCE($7, late_at),
        delinquent_at = COALESCE($8, delinquent_at),
        foreclosure_warning_at = COALESCE($9, foreclosure_warning_at),
        foreclosed_at = COALESCE($10, foreclosed_at),
        closed_at = COALESCE($11, closed_at),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
    [
      contractId,
      state,
      currentBalance === undefined ? null : currentBalance,
      timestamps.quoted_at,
      timestamps.approved_at,
      timestamps.activated_at,
      timestamps.late_at,
      timestamps.delinquent_at,
      timestamps.foreclosure_warning_at,
      timestamps.foreclosed_at,
      timestamps.closed_at,
    ],
  );

  return normalizeLoanContractRow(result.rows[0] ?? null);
}

module.exports = {
  LOAN_STATES,
  OPEN_LOAN_STATES,
  buildStateTimestamps,
  createLoanContract,
  getLoanContractById,
  getOpenLoanContract,
  isValidLoanState,
  listLoanContracts,
  listOpenLoanContracts,
  normalizeLoanContractRow,
  updateLoanContractBalance,
  updateLoanContractStatus,
  updateLoanContractState,
};
