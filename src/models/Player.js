const {
  buildVersionedCacheKey,
  bumpVersion,
  getJson,
  getVersion,
  isEnabled: isCacheEnabled,
  setJson,
} = require('../storage/cache');
const { ensureSchema, query, withTransaction } = require('../storage/postgres');

const ALLOWED_FIELDS = new Set([
  'cash',
  'bank',
  'debt',
  'exp',
  'level',
  'reputation',
  'relationship',
  'expMultiplier',
  'cashMultiplier',
  'interestMultiplier',
  'lastDailyBonusClaim',
  'stats',
]);

const NUMERIC_FIELDS = new Set([
  'exp',
  'level',
  'cash',
  'bank',
  'debt',
  'reputation',
  'relationship',
  'expMultiplier',
  'cashMultiplier',
  'interestMultiplier',
]);

function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value) {
  return isFiniteNumber(value) && value >= 0;
}

function normalizeDate(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePlayerData(data = {}) {
  const coerceNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    id: data.id ?? data._id ?? null,
    guildId: data.guildId ?? data.guild_id ?? '',
    userId: data.userId ?? data.user_id ?? '',
    exp: coerceNumber(data.exp ?? data.exp_value, 0),
    level: coerceNumber(data.level, 0),
    cash: coerceNumber(data.cash, 0),
    bank: coerceNumber(data.bank, 0),
    debt: coerceNumber(data.debt, 0),
    reputation: coerceNumber(data.reputation, 0),
    relationship: coerceNumber(data.relationship, 0),
    expMultiplier: coerceNumber(data.expMultiplier ?? data.exp_multiplier, 1),
    cashMultiplier: coerceNumber(
      data.cashMultiplier ?? data.cash_multiplier,
      1,
    ),
    interestMultiplier: coerceNumber(
      data.interestMultiplier ?? data.interest_multiplier,
      1,
    ),
    lastDailyBonusClaim: normalizeDate(
      data.lastDailyBonusClaim ?? data.last_daily_bonus_claim,
    ),
    stats: data.stats && typeof data.stats === 'object' ? data.stats : {},
    createdAt: normalizeDate(data.createdAt ?? data.created_at),
    updatedAt: normalizeDate(data.updatedAt ?? data.updated_at),
  };
}

function normalizePlayerPayload(player) {
  return {
    guildId: player.guildId,
    userId: player.userId,
    exp: player.exp ?? 0,
    level: player.level ?? 0,
    cash: player.cash ?? 0,
    bank: player.bank ?? 0,
    debt: player.debt ?? 0,
    reputation: player.reputation ?? 0,
    relationship: player.relationship ?? 0,
    expMultiplier: player.expMultiplier ?? 1,
    cashMultiplier: player.cashMultiplier ?? 1,
    interestMultiplier: player.interestMultiplier ?? 1,
    lastDailyBonusClaim: player.lastDailyBonusClaim ?? null,
    stats: player.stats ?? {},
  };
}

function playerToDbRow(player) {
  const payload = normalizePlayerPayload(player);

  return {
    guild_id: payload.guildId,
    user_id: payload.userId,
    exp: payload.exp,
    level: payload.level,
    cash: payload.cash,
    bank: payload.bank,
    debt: payload.debt,
    reputation: payload.reputation,
    relationship: payload.relationship,
    exp_multiplier: payload.expMultiplier,
    cash_multiplier: payload.cashMultiplier,
    interest_multiplier: payload.interestMultiplier,
    last_daily_bonus_claim: payload.lastDailyBonusClaim,
    stats: payload.stats,
  };
}

function validatePlayerPayload(player) {
  const payload = normalizePlayerPayload(player);
  if (!payload.guildId || !payload.userId) {
    return 'Guild and user IDs are required.';
  }

  for (const [field, value] of Object.entries(payload)) {
    if (field === 'lastDailyBonusClaim') {
      if (value !== null && !(value instanceof Date)) {
        return `Invalid value for ${field}.`;
      }
      if (value instanceof Date && Number.isNaN(value.getTime())) {
        return `Invalid value for ${field}.`;
      }
      continue;
    }

    if (field === 'stats') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return 'Stats must be an object.';
      }
      continue;
    }

    if (
      [
        'exp',
        'level',
        'cash',
        'bank',
        'debt',
        'reputation',
        'relationship',
        'expMultiplier',
        'cashMultiplier',
        'interestMultiplier',
      ].includes(field) &&
      !isNonNegativeFiniteNumber(value)
    ) {
      return `Invalid value for ${field}.`;
    }
  }

  return null;
}

function rowToPlainPlayerRow(row) {
  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    guildId: row.guild_id,
    exp: row.exp,
    level: row.level,
    cash: row.cash,
    bank: row.bank,
    debt: row.debt,
    reputation: row.reputation,
    relationship: row.relationship,
    expMultiplier: row.exp_multiplier,
    cashMultiplier: row.cash_multiplier,
    interestMultiplier: row.interest_multiplier,
    lastDailyBonusClaim: row.last_daily_bonus_claim,
    stats: row.stats,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    netWorth: row.net_worth,
  };
}

function rowToPlayer(row) {
  if (!row) {
    return null;
  }

  return new Player(rowToPlainPlayerRow(row));
}

function playerToPlain(player) {
  return {
    id: player.id ?? null,
    _id: player._id ?? player.id ?? null,
    userId: player.userId,
    guildId: player.guildId,
    exp: player.exp,
    level: player.level,
    cash: player.cash,
    bank: player.bank,
    debt: player.debt,
    reputation: player.reputation,
    relationship: player.relationship,
    expMultiplier: player.expMultiplier,
    cashMultiplier: player.cashMultiplier,
    interestMultiplier: player.interestMultiplier,
    lastDailyBonusClaim: player.lastDailyBonusClaim,
    stats: player.stats,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
    netWorth: player.cash + player.bank - player.debt,
  };
}

function projectPlayer(value, projection) {
  if (!projection) {
    return value;
  }

  const plain = value instanceof Player ? playerToPlain(value) : { ...value };
  const tokens = projection
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const includes = tokens.filter((token) => !token.startsWith('-'));
  const excludes = new Set(
    tokens
      .filter((token) => token.startsWith('-'))
      .map((token) => token.slice(1)),
  );

  if (includes.length > 0) {
    const selected = {};
    for (const field of includes) {
      if (field === '_id') {
        continue;
      }
      if (Object.hasOwn(plain, field)) {
        selected[field] = plain[field];
      }
    }
    return selected;
  }

  for (const field of excludes) {
    delete plain[field];
  }
  delete plain._id;
  return plain;
}

function normalizeSort(sortSpec) {
  if (!sortSpec || typeof sortSpec !== 'object') {
    return [];
  }

  return Object.entries(sortSpec).map(([field, direction]) => ({
    field,
    direction: Number(direction) < 0 ? -1 : 1,
  }));
}

function compareBySortSpec(a, b, sortSpec) {
  for (const { field, direction } of sortSpec) {
    const left = a[field];
    const right = b[field];
    if (left === right) {
      continue;
    }
    if (left === undefined || left === null) {
      return 1 * direction;
    }
    if (right === undefined || right === null) {
      return -1 * direction;
    }
    if (left < right) {
      return -1 * direction;
    }
    if (left > right) {
      return 1 * direction;
    }
  }
  return 0;
}

function buildWhere(filter, startIndex = 1) {
  const clauses = [];
  const values = [];

  for (const [field, rawValue] of Object.entries(filter || {})) {
    const column = toSnakeCase(field);

    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      if (Array.isArray(rawValue.$in)) {
        values.push(rawValue.$in);
        clauses.push(
          `${column} = ANY($${values.length + startIndex - 1}::text[])`,
        );
        continue;
      }

      if (rawValue.$eq !== undefined) {
        values.push(rawValue.$eq);
        clauses.push(`${column} = $${values.length + startIndex - 1}`);
        continue;
      }
    }

    values.push(rawValue);
    clauses.push(`${column} = $${values.length + startIndex - 1}`);
  }

  return {
    clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

function normalizeMutationFilter(filter = {}) {
  if (!filter || typeof filter !== 'object') {
    return {};
  }

  if (filter._id !== undefined) {
    return { id: filter._id };
  }

  if (filter.id !== undefined) {
    return { id: filter.id };
  }

  return filter;
}

function ensureValidValues(values) {
  for (const [field, value] of Object.entries(values || {})) {
    if (!ALLOWED_FIELDS.has(field)) {
      return `Invalid field: ${field}.`;
    }

    if (field === 'lastDailyBonusClaim') {
      if (value !== null && !(value instanceof Date)) {
        return `Invalid value for ${field}.`;
      }
      if (value instanceof Date && Number.isNaN(value.getTime())) {
        return `Invalid value for ${field}.`;
      }
      continue;
    }

    if (field === 'stats') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return 'Stats must be an object.';
      }
      continue;
    }

    if (NUMERIC_FIELDS.has(field) && !isNonNegativeFiniteNumber(value)) {
      return `Invalid value for ${field}.`;
    }

    if (!NUMERIC_FIELDS.has(field) && !isFiniteNumber(value)) {
      return `Invalid value for ${field}.`;
    }
  }

  return null;
}

function ensureValidIncrementValues(values) {
  for (const [field, value] of Object.entries(values || {})) {
    if (!ALLOWED_FIELDS.has(field)) {
      return `Invalid field: ${field}.`;
    }

    if (field === 'lastDailyBonusClaim' || field === 'stats') {
      return `Field ${field} cannot be incremented.`;
    }

    if (!NUMERIC_FIELDS.has(field) || !isFiniteNumber(value)) {
      return `Invalid increment for ${field}.`;
    }
  }

  return null;
}

async function loadPlayers(
  filter = {},
  { sortSpec = [], limit = null, client = null, lock = false } = {},
) {
  const { clause, values } = buildWhere(filter);
  const orderBy = sortSpec.length
    ? `ORDER BY ${sortSpec
        .map(
          ({ field, direction }) =>
            `${toSnakeCase(field)} ${direction < 0 ? 'DESC' : 'ASC'}`,
        )
        .join(', ')}`
    : '';
  const limitClause = Number.isInteger(limit) ? `LIMIT ${limit}` : '';
  const lockClause = lock ? 'FOR UPDATE' : '';

  const runner = client ?? { query };
  const { rows } = await runner.query(
    `
      SELECT *
      FROM players
      ${clause}
      ${orderBy}
      ${limitClause}
      ${lockClause}
    `,
    values,
  );

  return rows;
}

async function savePlayerRecord(player, client = null) {
  const validationError = validatePlayerPayload(player);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const payload = playerToDbRow(player);

  const runner = client ?? { query };
  const result = await runner.query(
    `
      INSERT INTO players (
        guild_id,
        user_id,
        exp,
        level,
        cash,
        bank,
        debt,
        reputation,
        relationship,
        exp_multiplier,
        cash_multiplier,
        interest_multiplier,
        last_daily_bonus_claim,
        stats,
        updated_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        NOW()
      )
      ON CONFLICT (guild_id, user_id) DO UPDATE SET
        exp = EXCLUDED.exp,
        level = EXCLUDED.level,
        cash = EXCLUDED.cash,
        bank = EXCLUDED.bank,
        debt = EXCLUDED.debt,
        reputation = EXCLUDED.reputation,
        relationship = EXCLUDED.relationship,
        exp_multiplier = EXCLUDED.exp_multiplier,
        cash_multiplier = EXCLUDED.cash_multiplier,
        interest_multiplier = EXCLUDED.interest_multiplier,
        last_daily_bonus_claim = EXCLUDED.last_daily_bonus_claim,
        stats = EXCLUDED.stats,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      payload.guild_id,
      payload.user_id,
      payload.exp,
      payload.level,
      payload.cash,
      payload.bank,
      payload.debt,
      payload.reputation,
      payload.relationship,
      payload.exp_multiplier,
      payload.cash_multiplier,
      payload.interest_multiplier,
      payload.last_daily_bonus_claim,
      payload.stats,
    ],
  );

  return { success: true, row: result.rows[0] };
}

async function invalidatePlayerGuildCache(guildId) {
  if (!guildId) {
    return;
  }

  await Promise.all([
    bumpVersion('player', guildId),
    bumpVersion('leaderboard', guildId),
    bumpVersion('tracked'),
  ]);
}

function extractUpdateOps(update = {}) {
  if (!update || typeof update !== 'object') {
    return { set: {}, inc: {} };
  }

  if (Object.hasOwn(update, '$set') || Object.hasOwn(update, '$inc')) {
    return {
      set:
        update.$set &&
        typeof update.$set === 'object' &&
        !Array.isArray(update.$set)
          ? update.$set
          : {},
      inc:
        update.$inc &&
        typeof update.$inc === 'object' &&
        !Array.isArray(update.$inc)
          ? update.$inc
          : {},
    };
  }

  return { set: update, inc: {} };
}

class Player {
  constructor(data = {}) {
    const normalized = normalizePlayerData(data);
    this.id = normalized.id;
    this._id = normalized.id;
    this.guildId = normalized.guildId;
    this.userId = normalized.userId;
    this.exp = normalized.exp;
    this.level = normalized.level;
    this.cash = normalized.cash;
    this.bank = normalized.bank;
    this.debt = normalized.debt;
    this.reputation = normalized.reputation;
    this.relationship = normalized.relationship;
    this.expMultiplier = normalized.expMultiplier;
    this.cashMultiplier = normalized.cashMultiplier;
    this.interestMultiplier = normalized.interestMultiplier;
    this.lastDailyBonusClaim = normalized.lastDailyBonusClaim;
    this.stats = normalized.stats;
    this.createdAt = normalized.createdAt;
    this.updatedAt = normalized.updatedAt;
  }

  get expBonus() {
    return this.expMultiplier;
  }

  set expBonus(value) {
    this.expMultiplier = value;
  }

  get cashBonus() {
    return this.cashMultiplier;
  }

  set cashBonus(value) {
    this.cashMultiplier = value;
  }

  toJSON() {
    return playerToPlain(this);
  }

  async save(options = {}) {
    await ensureSchema();
    const result = await savePlayerRecord(this, options.client ?? null);
    if (!result.success) {
      throw new Error(result.error);
    }

    Object.assign(this, normalizePlayerData(result.row));
    this._id = this.id;
    if (!options.client) {
      await invalidatePlayerGuildCache(this.guildId);
    }
    return this;
  }

  async incrementValues(values, options = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { success: false, error: 'Values must be an object.' };
    }

    const validationError = ensureValidIncrementValues(values);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const result = await Player.updateOne(
      { _id: this._id, guildId: this.guildId, userId: this.userId },
      { $inc: values },
      options,
    );

    if (!result.modifiedCount) {
      return { success: false, error: 'Failed to update player.' };
    }

    Object.assign(this, result.row);
    this._id = this.id;
    return { success: true, updatedPlayer: this };
  }

  async adjustCash(amount, options = {}) {
    return await this.incrementValues({ cash: amount }, options);
  }

  async adjustBank(amount, options = {}) {
    return await this.incrementValues({ bank: amount }, options);
  }

  async adjustDebt(amount, options = {}) {
    return await this.incrementValues({ debt: amount }, options);
  }

  async adjustExp(amount, options = {}) {
    return await this.incrementValues({ exp: amount }, options);
  }

  async updateCash(amount) {
    if (!isFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a valid number.' };
    }
    if (!isFiniteNumber(this.cash) || this.cash < 0) {
      return { success: false, error: 'Player cash balance is invalid.' };
    }
    if (this.cash + amount < 0) {
      return { success: false, error: 'Insufficient funds.' };
    }
    return await this.adjustCash(amount);
  }

  async updateBank(amount) {
    if (!isFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a valid number.' };
    }
    if (!isFiniteNumber(this.bank) || this.bank < 0) {
      return { success: false, error: 'Player bank balance is invalid.' };
    }
    if (this.bank + amount < 0) {
      return { success: false, error: 'Insufficient funds.' };
    }
    return await this.adjustBank(amount);
  }

  async updateDebt(amount) {
    if (!isFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a valid number.' };
    }
    if (!isFiniteNumber(this.debt) || this.debt < 0) {
      return { success: false, error: 'Player debt balance is invalid.' };
    }
    if (this.debt + amount < 0) {
      return { success: false, error: 'Debt cannot go below zero.' };
    }
    return await this.adjustDebt(amount);
  }

  async updateExp(amount) {
    if (!isFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a valid number.' };
    }
    if (!isFiniteNumber(this.exp) || this.exp < 0) {
      return { success: false, error: 'Player experience is invalid.' };
    }
    if (this.exp + amount < 0) {
      return { success: false, error: 'Experience cannot go below zero.' };
    }
    return await this.adjustExp(amount);
  }

  async setCash(amount, options = {}) {
    if (!isNonNegativeFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a positive value.' };
    }

    const result = await Player.updateOne(
      { _id: this._id, guildId: this.guildId, userId: this.userId },
      { $set: { cash: amount } },
      options,
    );

    if (!result.modifiedCount) {
      return { success: false, error: 'Failed to update cash balance.' };
    }

    Object.assign(this, result.row);
    this._id = this.id;
    return { success: true, newBalance: this.cash };
  }

  async setBank(amount, options = {}) {
    if (!isNonNegativeFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a positive value.' };
    }

    const result = await Player.updateOne(
      { _id: this._id, guildId: this.guildId, userId: this.userId },
      { $set: { bank: amount } },
      options,
    );

    if (!result.modifiedCount) {
      return { success: false, error: 'Failed to update bank balance.' };
    }

    Object.assign(this, result.row);
    this._id = this.id;
    return { success: true, newBalance: this.bank };
  }

  async setDebt(amount, options = {}) {
    if (!isNonNegativeFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a positive value.' };
    }

    const result = await Player.updateOne(
      { _id: this._id, guildId: this.guildId, userId: this.userId },
      { $set: { debt: amount } },
      options,
    );

    if (!result.modifiedCount) {
      return { success: false, error: 'Failed to update debt balance.' };
    }

    Object.assign(this, result.row);
    this._id = this.id;
    return { success: true, newBalance: this.debt };
  }

  async setExp(amount, options = {}) {
    if (!isNonNegativeFiniteNumber(amount)) {
      return { success: false, error: 'Amount must be a positive value.' };
    }

    const result = await Player.updateOne(
      { _id: this._id, guildId: this.guildId, userId: this.userId },
      { $set: { exp: amount } },
      options,
    );

    if (!result.modifiedCount) {
      return { success: false, error: 'Failed to update experience.' };
    }

    Object.assign(this, result.row);
    this._id = this.id;
    return { success: true, newExp: this.exp };
  }

  async setValues(values, options = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { success: false, error: 'Values must be an object.' };
    }

    const validationError = ensureValidValues(values);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const result = await Player.updateOne(
      { _id: this._id, guildId: this.guildId, userId: this.userId },
      { $set: values },
      options,
    );

    if (!result.modifiedCount) {
      return { success: false, error: 'Failed to update player.' };
    }

    Object.assign(this, result.row);
    this._id = this.id;
    return { success: true, updatedPlayer: this };
  }

  hasEnoughCash(amount) {
    return this.cash >= amount;
  }

  static async ensureReady() {
    await ensureSchema();
  }

  static findOne(filter = {}, options = {}) {
    return new PlayerQuery(filter, true, options);
  }

  static find(filter = {}, options = {}) {
    return new PlayerQuery(filter, false, options);
  }

  static async findById(playerId) {
    await Player.ensureReady();
    const result = await loadPlayers({ id: playerId }, { limit: 1 });
    return rowToPlayer(result[0] ?? null);
  }

  static async create(doc) {
    await Player.ensureReady();

    if (Array.isArray(doc)) {
      const created = [];
      for (const entry of doc) {
        created.push(await Player.create(entry));
      }
      return created;
    }

    const player = doc instanceof Player ? doc : new Player(doc);
    await player.save();
    return player;
  }

  static async ensurePlayer(filter = {}, options = {}) {
    await Player.ensureReady();

    const guildId = filter?.guildId;
    const userId = filter?.userId;
    const client = options.client ?? null;

    if (!guildId || !userId) {
      return null;
    }

    const runner = client ?? { query };
    const { rows } = await runner.query(
      `
        INSERT INTO players (guild_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (guild_id, user_id) DO UPDATE SET
          guild_id = players.guild_id
        RETURNING *;
      `,
      [guildId, userId],
    );

    return rowToPlayer(rows[0] ?? null);
  }

  static async ensurePlayers(records = [], options = {}) {
    await Player.ensureReady();

    if (!Array.isArray(records) || records.length === 0) {
      return [];
    }

    const uniqueRecords = new Map();
    for (const record of records) {
      const guildId = record?.guildId;
      const userId = record?.userId;

      if (!guildId || !userId) {
        continue;
      }

      uniqueRecords.set(`${guildId}:${userId}`, { guildId, userId });
    }

    const normalizedRecords = [...uniqueRecords.values()];
    if (normalizedRecords.length === 0) {
      return [];
    }

    const values = [];
    const placeholders = normalizedRecords.map(({ guildId, userId }) => {
      values.push(guildId, userId);
      return `($${values.length - 1}, $${values.length})`;
    });

    const runner = options.client ?? { query };
    const { rows } = await runner.query(
      `
        INSERT INTO players (guild_id, user_id)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (guild_id, user_id) DO UPDATE SET
          guild_id = players.guild_id
        RETURNING *;
      `,
      values,
    );

    return rows.map((row) => rowToPlayer(row));
  }

  static async deleteMany(filter = {}) {
    await Player.ensureReady();
    const normalizedFilter = normalizeMutationFilter(filter);
    const { clause, values } = buildWhere(normalizedFilter);
    const targetGuildIds =
      filter?.guildId && typeof filter.guildId === 'string'
        ? [filter.guildId]
        : [];

    const { rowCount } = await query(
      `
        DELETE FROM players
        ${clause};
      `,
      values,
    );

    await Promise.all([
      bumpVersion('tracked'),
      ...targetGuildIds.map((guildId) => bumpVersion('player', guildId)),
      ...targetGuildIds.map((guildId) => bumpVersion('leaderboard', guildId)),
    ]);

    return { acknowledged: true, deletedCount: rowCount ?? 0 };
  }

  static async updateOne(filter = {}, update = {}, options = {}) {
    await Player.ensureReady();

    const { set, inc } = extractUpdateOps(update);
    const setValidationError = ensureValidValues(set);
    if (setValidationError) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }

    const incValidationError = ensureValidIncrementValues(inc);
    if (incValidationError) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }

    const overlap = Object.keys(set).find((field) => Object.hasOwn(inc, field));
    if (overlap) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }

    const columns = [];
    const values = [];
    for (const [field, value] of Object.entries(set)) {
      if (field === 'lastDailyBonusClaim') {
        columns.push(`last_daily_bonus_claim = $${values.length + 1}`);
        values.push(value);
        continue;
      }

      if (field === 'stats') {
        columns.push(`stats = $${values.length + 1}`);
        values.push(value);
        continue;
      }

      columns.push(`${toSnakeCase(field)} = $${values.length + 1}`);
      values.push(value);
    }

    for (const [field, value] of Object.entries(inc)) {
      columns.push(
        `${toSnakeCase(field)} = ${toSnakeCase(field)} + $${values.length + 1}`,
      );
      values.push(value);
    }

    if (columns.length === 0) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }

    const { clause, values: whereValues } = buildWhere(
      normalizeMutationFilter(filter),
      values.length + 1,
    );
    const sql = `
      UPDATE players
      SET ${columns.join(', ')},
          updated_at = NOW()
      ${clause}
      RETURNING *;
    `;

    let result;
    try {
      result = options.client
        ? await options.client.query(sql, [...values, ...whereValues])
        : await query(sql, [...values, ...whereValues]);
    } catch (error) {
      if (error?.code === '23514' || error?.code === '22003') {
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      }
      throw error;
    }

    const matchedCount = result.rowCount ?? 0;
    if (matchedCount > 0 && !options.client) {
      const touchedGuildIds = new Set(
        result.rows.map((row) => row.guild_id).filter(Boolean),
      );
      await Promise.all([
        bumpVersion('tracked'),
        ...[...touchedGuildIds].map((guildId) =>
          bumpVersion('player', guildId),
        ),
        ...[...touchedGuildIds].map((guildId) =>
          bumpVersion('leaderboard', guildId),
        ),
      ]);
    }

    return {
      acknowledged: true,
      matchedCount,
      modifiedCount: matchedCount,
      row: result.rows[0] ? rowToPlayer(result.rows[0]) : null,
    };
  }

  static async findByGuild(guildId) {
    return await this.find({ guildId });
  }

  static async distinct(field) {
    await Player.ensureReady();

    if (field !== 'guildId') {
      return [];
    }

    const version = await getVersion('tracked');
    const cacheKey = buildVersionedCacheKey(
      'distinct',
      'tracked',
      { field },
      version,
    );
    if (isCacheEnabled()) {
      const cached = await getJson(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const { rows } = await query(
      `
        SELECT DISTINCT guild_id
        FROM players
        UNION
        SELECT DISTINCT guild_id
        FROM lakes
        ORDER BY guild_id ASC
      `,
    );

    const guildIds = rows.map((row) => row.guild_id).filter(Boolean);
    if (isCacheEnabled()) {
      await setJson(cacheKey, guildIds, 60);
    }

    return guildIds;
  }

  static async aggregate(pipeline = []) {
    await Player.ensureReady();
    if (!Array.isArray(pipeline) || pipeline.length === 0) {
      return [];
    }

    const matchStage = pipeline.find((stage) => stage.$match);
    const projectStage = pipeline.find((stage) => stage.$project);
    const sortStage = pipeline.find((stage) => stage.$sort);
    const limitStage = pipeline.find((stage) => stage.$limit);

    const filter = matchStage?.$match ?? {};
    const rows = await loadPlayers(filter);
    let data = rows.map((row) => rowToPlayer(row));

    if (projectStage?.$project) {
      data = data.map((player) => {
        const projected = {};
        for (const [field, expr] of Object.entries(projectStage.$project)) {
          if (expr === 1) {
            projected[field] = player[field];
            continue;
          }

          if (
            expr &&
            typeof expr === 'object' &&
            expr.$subtract &&
            Array.isArray(expr.$subtract)
          ) {
            projected[field] =
              evaluateExpression(expr.$subtract[0], player) -
              evaluateExpression(expr.$subtract[1], player);
          }
        }
        return projected;
      });
    }

    if (sortStage?.$sort) {
      const sortSpec = normalizeSort(sortStage.$sort);
      data.sort((left, right) => compareBySortSpec(left, right, sortSpec));
    }

    if (Number.isInteger(limitStage?.$limit)) {
      data = data.slice(0, limitStage.$limit);
    }

    return data;
  }

  static async transferCurrency(guildId, playerAUserId, playerBUserId, amount) {
    await Player.ensureReady();

    if (!guildId || !playerAUserId || !playerBUserId) {
      return { success: false, error: 'Guild and user IDs are required.' };
    }

    if (!isFiniteNumber(amount) || amount <= 0) {
      return { success: false, error: 'Invalid transfer amount.' };
    }

    if (playerAUserId === playerBUserId) {
      return {
        success: false,
        error: 'Sender and recipient must be different.',
      };
    }

    try {
      const result = await withTransaction(async (client) => {
        const [playerA, playerB] = await Promise.all([
          Player.findOne(
            { guildId, userId: playerAUserId },
            { client, lock: true },
          ),
          Player.findOne(
            { guildId, userId: playerBUserId },
            { client, lock: true },
          ),
        ]);

        if (!playerA) {
          return { success: false, error: 'Sender not found.' };
        }

        if (!playerB) {
          return { success: false, error: 'Recipient not found.' };
        }

        if (!isNonNegativeFiniteNumber(playerA.cash)) {
          return { success: false, error: 'Player cash balance is invalid.' };
        }

        if (!isNonNegativeFiniteNumber(playerB.cash)) {
          return {
            success: false,
            error: 'Recipient cash balance is invalid.',
          };
        }

        if (playerA.cash < amount) {
          return { success: false, error: 'Insufficient cash.' };
        }

        const senderCash = playerA.cash - amount;
        const recipientCash = playerB.cash + amount;

        const senderResult = await Player.updateOne(
          { _id: playerA._id, guildId, userId: playerAUserId },
          { $set: { cash: senderCash } },
          { client },
        );

        if (senderResult.modifiedCount !== 1) {
          return {
            success: false,
            error: 'Failed to update sender balance.',
          };
        }

        const recipientResult = await Player.updateOne(
          { _id: playerB._id, guildId, userId: playerBUserId },
          { $set: { cash: recipientCash } },
          { client },
        );

        if (recipientResult.modifiedCount !== 1) {
          await Player.updateOne(
            { _id: playerA._id, guildId, userId: playerAUserId },
            { $set: { cash: playerA.cash } },
            { client },
          );
          return {
            success: false,
            error: 'Failed to update recipient balance.',
          };
        }

        return {
          success: true,
          playerA: await Player.findOne(
            { guildId, userId: playerAUserId },
            { client },
          ),
          playerB: await Player.findOne(
            { guildId, userId: playerBUserId },
            { client },
          ),
          transferredAmount: amount,
        };
      });

      if (result.success) {
        await Promise.all([
          bumpVersion('player', guildId),
          bumpVersion('leaderboard', guildId),
          bumpVersion('tracked'),
        ]);
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async compareNetWorthToTopInGuild(netWorth, guildId) {
    await Player.ensureReady();
    const topPlayers = await this.find({ guildId })
      .sort({ cash: -1, bank: -1, debt: 1 })
      .limit(30)
      .lean();

    const totalTopNetWorth = topPlayers.reduce(
      (acc, player) => acc + player.cash + player.bank - player.debt,
      0,
    );

    const sortedNetWorths = topPlayers
      .map((player) => player.cash + player.bank - player.debt)
      .concat(netWorth)
      .sort((a, b) => b - a);
    const rank = sortedNetWorths.indexOf(netWorth) + 1;
    const percentageOfTop =
      totalTopNetWorth === 0 ? 0 : (netWorth / totalTopNetWorth) * 100;
    const isInTop = rank <= 30;

    return {
      isInTop,
      rank,
      percentageOfTop,
      totalTopNetWorth,
    };
  }

  static async getPlayer(playerId) {
    return await this.findById(playerId);
  }

  static async getPlayersByGuild(guildId) {
    return await this.find({ guildId });
  }

  static async getTopPlayersByCash(limit = 10) {
    return await this.find().sort({ cash: -1 }).limit(limit);
  }

  static async getTopPlayersByDebt(limit = 10) {
    return await this.find().sort({ debt: -1 }).limit(limit);
  }

  static async getTopPlayersByLevel(limit = 10) {
    return await this.find().sort({ level: -1 }).limit(limit);
  }

  static async getTopPlayersByExp(limit = 10) {
    return await this.find().sort({ level: -1, exp: -1 }).limit(limit);
  }

  static async getTotalCurrencyByGuild(guildId) {
    const players = await this.find({ guildId }).lean();
    return players.reduce(
      (total, player) => total + player.cash + player.bank,
      0,
    );
  }
}

class PlayerQuery {
  constructor(filter = {}, single = false, options = {}) {
    this.filter = filter;
    this.single = single;
    this.options = options;
    this._sort = null;
    this._limit = null;
    this._select = null;
    this._lean = false;
    this._lock = Boolean(options.lock);
  }

  select(value) {
    this._select = value;
    return this;
  }

  sort(value) {
    this._sort = value;
    return this;
  }

  limit(value) {
    this._limit = Number.isInteger(value) ? value : null;
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  session() {
    return this;
  }

  async exec() {
    await Player.ensureReady();

    const guildId = this.filter?.guildId;
    const client = this.options?.client ?? null;
    const cacheable =
      Boolean(guildId) && isCacheEnabled() && !client && !this._lock;
    const version = cacheable
      ? await getVersion(this.single ? 'player' : 'leaderboard', guildId)
      : null;
    const cacheKey = cacheable
      ? buildVersionedCacheKey(
          this.single ? 'player_query' : 'player_query',
          guildId,
          {
            filter: this.filter,
            sort: this._sort,
            limit: this._limit,
            select: this._select,
            lean: this._lean,
            single: this.single,
          },
          version,
        )
      : null;

    if (cacheKey) {
      const cached = await getJson(cacheKey);
      if (cached) {
        return this.single
          ? this._lean
            ? cached
            : new Player(cached)
          : cached.map((row) => (this._lean ? row : new Player(row)));
      }
    }

    const rows = await loadPlayers(this.filter, {
      sortSpec: normalizeSort(this._sort),
      limit: this._limit,
      client,
      lock: this._lock,
    });
    let results = rows.map((row) => rowToPlayer(row));

    if (this.single) {
      let value = results[0] ?? null;
      if (this._select) {
        value = value ? projectPlayer(value, this._select) : null;
      }

      if (cacheKey) {
        await setJson(
          cacheKey,
          value ? playerToPlain(rowToPlayerIfNeeded(value)) : null,
          60,
        );
      }

      return this._lean || this._select
        ? (value ?? null)
        : value
          ? rowToPlayerIfNeeded(value)
          : null;
    }

    if (this._select) {
      results = results.map((player) => projectPlayer(player, this._select));
    }

    if (cacheKey) {
      const cachePayload = results.map((item) =>
        item instanceof Player ? playerToPlain(item) : item,
      );
      await setJson(cacheKey, cachePayload, 60);
    }

    return this._lean
      ? results
      : results.map((item) =>
          item instanceof Player ? item : rowToPlayerIfNeeded(item),
        );
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

function evaluateExpression(expression, player) {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    const field = expression.slice(1);
    return player[field] ?? 0;
  }

  if (typeof expression === 'number') {
    return expression;
  }

  if (expression && typeof expression === 'object') {
    if (Array.isArray(expression.$add)) {
      return expression.$add.reduce(
        (sum, part) => sum + evaluateExpression(part, player),
        0,
      );
    }

    if (
      Array.isArray(expression.$subtract) &&
      expression.$subtract.length >= 2
    ) {
      return (
        evaluateExpression(expression.$subtract[0], player) -
        evaluateExpression(expression.$subtract[1], player)
      );
    }
  }

  return 0;
}

function rowToPlayerIfNeeded(value) {
  if (value instanceof Player) {
    return value;
  }

  return new Player({
    id: value.id,
    userId: value.userId,
    guildId: value.guildId,
    exp: value.exp,
    level: value.level,
    cash: value.cash,
    bank: value.bank,
    debt: value.debt,
    reputation: value.reputation,
    relationship: value.relationship,
    expMultiplier: value.expMultiplier,
    cashMultiplier: value.cashMultiplier,
    interestMultiplier: value.interestMultiplier,
    lastDailyBonusClaim: value.lastDailyBonusClaim,
    stats: value.stats,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

module.exports = Player;
