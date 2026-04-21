const {
  buildVersionedCacheKey,
  bumpVersion,
  getJson,
  getVersion,
  isEnabled: isCacheEnabled,
  setJson,
} = require('../storage/cache');
const { ensureSchema, query, withTransaction } = require('../storage/postgres');

function isValidFishEntry(fishType, count, reward) {
  return (
    typeof fishType === 'string' &&
    fishType.trim().length > 0 &&
    Number.isFinite(count) &&
    Number.isFinite(reward)
  );
}

function normalizeFishStock(fishStock) {
  if (!Array.isArray(fishStock)) {
    return [];
  }

  return fishStock.map((fish) => ({
    type: fish.type,
    count: Number.isFinite(Number(fish.count)) ? Number(fish.count) : 0,
    reward: Number.isFinite(Number(fish.reward)) ? Number(fish.reward) : 0,
  }));
}

function normalizeOwnershipType(ownershipType) {
  return ownershipType === 'clan' ? 'clan' : 'public';
}

function rowToLake(row, fishStock = []) {
  if (!row) {
    return null;
  }

  return new Lake({
    id: row.id,
    _id: row.id,
    guildId: row.guild_id,
    ownershipType: row.ownership_type,
    lastStocked: row.last_stocked,
    fishStock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

async function loadLakeRow(guildId, client = null, lock = false) {
  const runner = client ?? {
    query,
  };
  const lakeResult = await runner.query(
    `
      SELECT *
      FROM lakes
      WHERE guild_id = $1
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''};
    `,
    [guildId],
  );

  const lakeRow = lakeResult.rows[0] ?? null;
  if (!lakeRow) {
    return null;
  }

  const fishResult = await runner.query(
    `
      SELECT fish_type, count, reward
      FROM lake_fish_stock
      WHERE lake_id = $1
      ORDER BY fish_type ASC;
    `,
    [lakeRow.id],
  );

  const fishStock = fishResult.rows.map((row) => ({
    type: row.fish_type,
    count: row.count,
    reward: row.reward,
  }));

  return rowToLake(lakeRow, fishStock);
}

async function saveLakeRecord(lake, client = null) {
  if (!lake.guildId) {
    return { success: false, error: 'Guild ID is required.' };
  }

  const ownershipType = normalizeOwnershipType(lake.ownershipType);
  lake.ownershipType = ownershipType;
  const fishStock = normalizeFishStock(lake.fishStock);

  const runner = client ?? null;

  const write = async (txClient) => {
    const lakeResult = await txClient.query(
      `
        INSERT INTO lakes (guild_id, ownership_type, last_stocked, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (guild_id) DO UPDATE SET
          ownership_type = EXCLUDED.ownership_type,
          last_stocked = EXCLUDED.last_stocked,
          updated_at = NOW()
        RETURNING *;
      `,
      [lake.guildId, ownershipType, lake.lastStocked ?? null],
    );

    const savedLake = lakeResult.rows[0];

    await txClient.query(
      `
        DELETE FROM lake_fish_stock
        WHERE lake_id = $1;
      `,
      [savedLake.id],
    );

    for (const fish of fishStock) {
      await txClient.query(
        `
          INSERT INTO lake_fish_stock (lake_id, fish_type, count, reward)
          VALUES ($1, $2, $3, $4);
        `,
        [savedLake.id, fish.type, fish.count, fish.reward],
      );
    }

    return { success: true, row: savedLake };
  };

  if (runner) {
    return await write(runner);
  }

  return await withTransaction(write);
}

class Lake {
  constructor(data = {}) {
    this.id = data.id ?? data._id ?? null;
    this._id = this.id;
    this.guildId = data.guildId ?? data.guild_id ?? '';
    this.ownershipType = normalizeOwnershipType(
      data.ownershipType ?? data.ownership_type,
    );
    this.fishStock = normalizeFishStock(
      data.fishStock ?? data.fish_stock ?? [],
    );
    this.lastStocked = data.lastStocked ?? data.last_stocked ?? null;
    this.createdAt = data.createdAt ?? data.created_at ?? null;
    this.updatedAt = data.updatedAt ?? data.updated_at ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      guildId: this.guildId,
      ownershipType: this.ownershipType,
      fishStock: this.fishStock,
      lastStocked: this.lastStocked,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  async save(options = {}) {
    await ensureSchema();
    const result = await saveLakeRecord(this, options.client ?? null);
    if (!result.success) {
      throw new Error(result.error);
    }

    if (options.client) {
      Object.assign(this, {
        id: result.row.id,
        _id: result.row.id,
        ownershipType: result.row.ownership_type,
        lastStocked: result.row.last_stocked,
        createdAt: result.row.created_at,
        updatedAt: result.row.updated_at,
      });
    } else {
      await Promise.all([
        bumpVersion('lake', this.guildId),
        bumpVersion('tracked'),
      ]);

      const refreshed = await Lake.findOne({ guildId: this.guildId });
      if (refreshed) {
        Object.assign(this, refreshed);
        this._id = this.id;
      }
    }

    return this;
  }

  async updateFishStock(fishType, count, reward, options = {}) {
    if (!isValidFishEntry(fishType, count, reward)) {
      return {
        success: false,
        message: 'Invalid fish stock update.',
      };
    }

    const fishIndex = this.fishStock.findIndex(
      (fish) => fish.type === fishType,
    );
    const previousStock =
      fishIndex !== -1 ? this.fishStock[fishIndex].count : null;

    if (fishIndex !== -1 && this.fishStock[fishIndex].count + count < 0) {
      return {
        success: false,
        message: 'Fish stock cannot go below zero.',
      };
    }

    if (fishIndex === -1 && count < 0) {
      return {
        success: false,
        message: 'Fish stock cannot go below zero.',
      };
    }

    if (fishIndex !== -1) {
      this.fishStock[fishIndex].count += count;
    } else {
      this.fishStock.push({ type: fishType, count, reward });
    }

    try {
      await this.save(options);
    } catch (error) {
      if (fishIndex !== -1) {
        this.fishStock[fishIndex].count = previousStock;
      } else {
        this.fishStock.pop();
      }

      return { success: false, message: error.message || 'Save failed.' };
    }

    return { success: true, fishStock: this.fishStock };
  }

  static async ensureReady() {
    await ensureSchema();
  }

  static async findOne(filter = {}, options = {}) {
    await Lake.ensureReady();
    const guildId = filter.guildId ?? filter.guild_id;
    if (!guildId) {
      return null;
    }

    const client = options.client ?? null;
    const lock = Boolean(options.lock);
    const cacheable = !client && !lock && isCacheEnabled();
    const version = cacheable ? await getVersion('lake', guildId) : 0;
    const cacheKey = cacheable
      ? buildVersionedCacheKey('lake_query', guildId, { guildId }, version)
      : null;
    if (cacheKey) {
      const cached = await getJson(cacheKey);
      if (cached) {
        return new Lake(cached);
      }
    }

    const lake = await loadLakeRow(guildId, client, lock);
    if (cacheKey && lake) {
      await setJson(cacheKey, lake.toJSON(), 120);
    }

    return lake;
  }

  static async create(doc) {
    await Lake.ensureReady();

    if (Array.isArray(doc)) {
      const created = [];
      for (const entry of doc) {
        created.push(await Lake.create(entry));
      }
      return created;
    }

    const lake = doc instanceof Lake ? doc : new Lake(doc);
    await lake.save();
    return lake;
  }

  static async deleteMany(filter = {}) {
    await Lake.ensureReady();
    const guildId = filter.guildId ?? filter.guild_id;
    if (guildId) {
      const { rowCount } = await query(
        `
          DELETE FROM lakes
          WHERE guild_id = $1;
        `,
        [guildId],
      );
      await Promise.all([bumpVersion('lake', guildId), bumpVersion('tracked')]);
      return { acknowledged: true, deletedCount: rowCount ?? 0 };
    }

    const { rowCount } = await query('DELETE FROM lakes;');
    await Promise.all([bumpVersion('tracked')]);
    return { acknowledged: true, deletedCount: rowCount ?? 0 };
  }

  static async distinct(field, filter = {}) {
    await Lake.ensureReady();
    if (field !== 'guildId') {
      return [];
    }

    const ownershipType = filter?.ownershipType
      ? normalizeOwnershipType(filter.ownershipType)
      : null;
    const version = await getVersion('tracked');
    const cacheKey = isCacheEnabled()
      ? buildVersionedCacheKey(
          'lake_distinct',
          'tracked',
          { field, ownershipType: ownershipType ?? 'any' },
          version,
        )
      : null;
    if (cacheKey) {
      const cached = await getJson(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const { rows } = await query(
      `
        SELECT DISTINCT guild_id
        FROM lakes
        ${ownershipType ? 'WHERE ownership_type = $1' : ''}
        ORDER BY guild_id ASC;
      `,
      ownershipType ? [ownershipType] : [],
    );

    const guildIds = rows.map((row) => row.guild_id).filter(Boolean);
    if (cacheKey) {
      await setJson(cacheKey, guildIds, 60);
    }

    return guildIds;
  }
}

module.exports = Lake;
