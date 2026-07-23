const { randomUUID } = require('node:crypto');
const { query } = require('./postgres');
const {
  normalizeActivePillEffects,
  normalizeActionState,
  normalizePillInventory,
  normalizeTechniqueLoadout,
} = require('../modules/cultivation/loadoutCatalog');

function resolveRunner(options = {}) {
  return options.client ?? { query };
}

let backgroundDefinitionsCache = null;
let realmDefinitionsCache = null;

function clearCultivationReferenceCache() {
  backgroundDefinitionsCache = null;
  realmDefinitionsCache = null;
}

async function loadBackgroundDefinitions(options = {}) {
  if (backgroundDefinitionsCache) {
    return backgroundDefinitionsCache;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM background_definitions
      ORDER BY key ASC;
    `,
  );

  backgroundDefinitionsCache = result.rows.map((row) =>
    normalizeBackgroundDefinitionRow(row),
  );
  return backgroundDefinitionsCache;
}

async function loadRealmDefinitions(options = {}) {
  if (realmDefinitionsCache) {
    return realmDefinitionsCache;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM realm_definitions
      ORDER BY realm_index ASC;
    `,
  );

  realmDefinitionsCache = result.rows.map((row) =>
    normalizeRealmDefinitionRow(row),
  );
  return realmDefinitionsCache;
}

function normalizeString(value, fallback = null) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function normalizeNullableNonNegativeInteger(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePlayerRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    discordUserId: row.discord_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeBackgroundDefinitionRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    physiqueMod: row.physique_mod,
    comprehensionMod: row.comprehension_mod,
    spiritMod: row.spirit_mod,
    fortuneMod: row.fortune_mod,
  };
}

function normalizeRealmDefinitionRow(row) {
  if (!row) {
    return null;
  }

  return {
    realmIndex: row.realm_index,
    name: row.name,
    stageMax: row.stage_max,
    baseLifespanBonus: row.base_lifespan_bonus,
    hasTribulation: row.has_tribulation,
  };
}

function normalizeCharacterRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    playerId: row.player_id,
    name: row.name,
    sex: row.sex,
    age: row.age,
    lifespanMax: row.lifespan_max,
    backgroundId: row.background_id,
    alignment: row.alignment,
    virtue: row.virtue,
    path: row.path,
    daoFocus: row.dao_focus,
    currentTitleId: row.current_title_id,
    currentRegionId: row.current_region_id,
    currentLocationId: row.current_location_id,
    isAlive: row.is_alive,
    isSealed: row.is_sealed,
    isMissing: row.is_missing,
    isRetired: row.is_retired,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCharacterAttributesRow(row) {
  if (!row) {
    return null;
  }

  return {
    characterId: row.character_id,
    physique: row.physique,
    comprehension: row.comprehension,
    spirit: row.spirit,
    fortune: row.fortune,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCharacterTalentRow(row) {
  if (!row) {
    return null;
  }

  return {
    characterId: row.character_id,
    rootType: row.root_type,
    rootQuality: row.root_quality,
    specialConstitution: row.special_constitution,
    affinityPrimary: row.affinity_primary,
    affinitySecondary: row.affinity_secondary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCharacterCultivationRow(row) {
  if (!row) {
    return null;
  }

  return {
    characterId: row.character_id,
    realmIndex: row.realm_index ?? null,
    stage: row.stage,
    stageProgress: row.stage_progress,
    cultivationBase: row.cultivation_base,
    spiritEnergy: row.spirit_energy ?? row.qi_current ?? 0,
    earnRateMultiplier: row.earn_rate_multiplier ?? 1,
    breakthroughPreparationState: normalizeActionState(
      row.breakthrough_preparation_state,
    ),
    qiCurrent: row.qi_current,
    qiQuality: row.qi_quality,
    foundationQuality: row.foundation_quality,
    breakthroughFailures: row.breakthrough_failures ?? 0,
    techniqueSlots: normalizeTechniqueLoadout(row.technique_slots),
    pillCounters: normalizePillInventory(row.pill_counters),
    pillBuffs: normalizeActivePillEffects(row.pill_buffs),
    lastProgressAt: row.last_progress_at,
    lastBreakthroughAt: row.last_breakthrough_at,
    meditationStartedAt: row.meditation_started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCharacterStatusRow(row) {
  if (!row) {
    return null;
  }

  return {
    characterId: row.character_id,
    hpCurrent: row.hp_current,
    condition: row.condition,
    state: row.state,
    meridianState: row.meridian_state,
    dantianState: row.dantian_state,
    mentalState: row.mental_state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeFullCharacterProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    player: normalizePlayerRow({
      id: row.player_id,
      discord_user_id: row.discord_user_id,
      created_at: row.player_created_at,
      updated_at: row.player_updated_at,
    }),
    character: normalizeCharacterRow({
      id: row.character_id,
      player_id: row.player_id,
      name: row.character_name,
      sex: row.sex,
      age: row.age,
      lifespan_max: row.lifespan_max,
      background_id: row.background_id,
      alignment: row.alignment,
      virtue: row.virtue,
      path: row.path,
      dao_focus: row.dao_focus,
      current_title_id: row.current_title_id,
      current_region_id: row.current_region_id,
      current_location_id: row.current_location_id,
      is_alive: row.is_alive,
      is_sealed: row.is_sealed,
      is_missing: row.is_missing,
      is_retired: row.is_retired,
      created_at: row.character_created_at,
      updated_at: row.character_updated_at,
    }),
    attributes: normalizeCharacterAttributesRow({
      character_id: row.character_id,
      physique: row.physique,
      comprehension: row.comprehension,
      spirit: row.spirit,
      fortune: row.fortune,
      created_at: row.attributes_created_at,
      updated_at: row.attributes_updated_at,
    }),
    talent: normalizeCharacterTalentRow({
      character_id: row.character_id,
      root_type: row.root_type,
      root_quality: row.root_quality,
      special_constitution: row.special_constitution,
      affinity_primary: row.affinity_primary,
      affinity_secondary: row.affinity_secondary,
      created_at: row.talent_created_at,
      updated_at: row.talent_updated_at,
    }),
    cultivation: normalizeCharacterCultivationRow({
      character_id: row.character_id,
      realm_index: row.realm_index,
      stage: row.stage,
      stage_progress: row.stage_progress,
      cultivation_base: row.cultivation_base,
      spirit_energy: row.spirit_energy,
      qi_current: row.qi_current,
      qi_quality: row.qi_quality,
      foundation_quality: row.foundation_quality,
      breakthrough_failures: row.breakthrough_failures,
      breakthrough_preparation_state: row.breakthrough_preparation_state,
      technique_slots: row.technique_slots,
      pill_counters: row.pill_counters,
      pill_buffs: row.pill_buffs,
      last_progress_at: row.last_progress_at,
      last_breakthrough_at: row.last_breakthrough_at,
      meditation_started_at: row.meditation_started_at,
      created_at: row.cultivation_created_at,
      updated_at: row.cultivation_updated_at,
    }),
    status: normalizeCharacterStatusRow({
      character_id: row.character_id,
      hp_current: row.hp_current,
      condition: row.condition,
      state: row.state,
      meridian_state: row.meridian_state,
      dantian_state: row.dantian_state,
      mental_state: row.mental_state,
      created_at: row.status_created_at,
      updated_at: row.status_updated_at,
    }),
    background: normalizeBackgroundDefinitionRow({
      id: row.background_definition_id,
      key: row.background_key,
      name: row.background_name,
      description: row.background_description,
      physique_mod: row.background_physique_mod,
      comprehension_mod: row.background_comprehension_mod,
      spirit_mod: row.background_spirit_mod,
      fortune_mod: row.background_fortune_mod,
    }),
    realm: normalizeRealmDefinitionRow({
      realm_index: row.realm_index,
      name: row.realm_name,
      stage_max: row.stage_max,
      base_lifespan_bonus: row.base_lifespan_bonus,
      has_tribulation: row.has_tribulation,
    }),
  };
}

function resolveDiscordUserId(discordUserId) {
  return normalizeString(discordUserId);
}

async function findPlayerByDiscordUserId(discordUserId, options = {}) {
  const normalizedDiscordUserId = resolveDiscordUserId(discordUserId);
  if (!normalizedDiscordUserId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM players
      WHERE discord_user_id = $1
      LIMIT 1;
    `,
    [normalizedDiscordUserId],
  );

  return normalizePlayerRow(result.rows[0] ?? null);
}

async function findPlayerById(playerId, options = {}) {
  const normalizedPlayerId = normalizeString(playerId);
  if (!normalizedPlayerId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM players
      WHERE id = $1
      LIMIT 1;
    `,
    [normalizedPlayerId],
  );

  return normalizePlayerRow(result.rows[0] ?? null);
}

async function createPlayerRecord(
  { id = randomUUID(), discordUserId } = {},
  options = {},
) {
  const normalizedDiscordUserId = resolveDiscordUserId(discordUserId);
  if (!normalizedDiscordUserId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      INSERT INTO players (
        id,
        discord_user_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (discord_user_id) DO NOTHING
      RETURNING *;
    `,
    [id, normalizedDiscordUserId],
  );

  if (result.rows[0]) {
    return normalizePlayerRow(result.rows[0]);
  }

  return await findPlayerByDiscordUserId(normalizedDiscordUserId, options);
}

async function findBackgroundDefinitionById(backgroundId, options = {}) {
  const normalizedBackgroundId = normalizeString(backgroundId);
  if (!normalizedBackgroundId) {
    return null;
  }

  const backgrounds = await loadBackgroundDefinitions(options);
  return (
    backgrounds.find(
      (background) => background.id === normalizedBackgroundId,
    ) ?? null
  );
}

async function findBackgroundDefinitionByKey(backgroundKey, options = {}) {
  const normalizedBackgroundKey = normalizeString(backgroundKey);
  if (!normalizedBackgroundKey) {
    return null;
  }

  const backgrounds = await loadBackgroundDefinitions(options);
  return (
    backgrounds.find(
      (background) => background.key === normalizedBackgroundKey,
    ) ?? null
  );
}

async function listBackgroundDefinitions(options = {}) {
  return await loadBackgroundDefinitions(options);
}

async function findRealmDefinitionByIndex(realmIndex, options = {}) {
  const normalizedRealmIndex = Number(realmIndex);
  if (!Number.isInteger(normalizedRealmIndex)) {
    return null;
  }

  const realms = await loadRealmDefinitions(options);
  return (
    realms.find((realm) => realm.realmIndex === normalizedRealmIndex) ?? null
  );
}

async function listRealmDefinitions(options = {}) {
  return await loadRealmDefinitions(options);
}

async function findCharacterById(characterId, options = {}) {
  const normalizedCharacterId = normalizeString(characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM characters
      WHERE id = $1
      LIMIT 1;
    `,
    [normalizedCharacterId],
  );

  return normalizeCharacterRow(result.rows[0] ?? null);
}

async function findCharacterByPlayerId(playerId, options = {}) {
  const normalizedPlayerId = normalizeString(playerId);
  if (!normalizedPlayerId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM characters
      WHERE player_id = $1
      LIMIT 1;
    `,
    [normalizedPlayerId],
  );

  return normalizeCharacterRow(result.rows[0] ?? null);
}

async function createCharacterRecord(character, options = {}) {
  if (!character || typeof character !== 'object' || Array.isArray(character)) {
    return null;
  }

  const normalizedCharacter = {
    id: normalizeString(character.id) ?? randomUUID(),
    playerId: normalizeString(character.playerId),
    name: normalizeString(character.name),
    sex: character.sex ?? null,
    age: normalizeNonNegativeInteger(character.age, 0),
    lifespanMax: normalizeNonNegativeInteger(character.lifespanMax, 0),
    backgroundId: normalizeString(character.backgroundId, null),
    alignment: normalizeString(character.alignment, 'neutral'),
    virtue: normalizeNonNegativeInteger(character.virtue, 0),
    path: normalizeString(character.path, 'balanced'),
    daoFocus: character.daoFocus ?? null,
    currentTitleId: character.currentTitleId ?? null,
    currentRegionId: character.currentRegionId ?? null,
    currentLocationId: character.currentLocationId ?? null,
    isAlive: normalizeBoolean(character.isAlive, true),
    isSealed: normalizeBoolean(character.isSealed, false),
    isMissing: normalizeBoolean(character.isMissing, false),
    isRetired: normalizeBoolean(character.isRetired, false),
  };

  if (!normalizedCharacter.playerId || !normalizedCharacter.name) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      INSERT INTO characters (
        id,
        player_id,
        name,
        sex,
        age,
        lifespan_max,
        background_id,
        alignment,
        virtue,
        path,
        dao_focus,
        current_title_id,
        current_region_id,
        current_location_id,
        is_alive,
        is_sealed,
        is_missing,
        is_retired,
        created_at,
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
        $15,
        $16,
        $17,
        $18,
        NOW(),
        NOW()
      )
      ON CONFLICT (player_id) DO NOTHING
      RETURNING *;
    `,
    [
      normalizedCharacter.id,
      normalizedCharacter.playerId,
      normalizedCharacter.name,
      normalizedCharacter.sex,
      normalizedCharacter.age,
      normalizedCharacter.lifespanMax,
      normalizedCharacter.backgroundId,
      normalizedCharacter.alignment,
      normalizedCharacter.virtue,
      normalizedCharacter.path,
      normalizedCharacter.daoFocus,
      normalizedCharacter.currentTitleId,
      normalizedCharacter.currentRegionId,
      normalizedCharacter.currentLocationId,
      normalizedCharacter.isAlive,
      normalizedCharacter.isSealed,
      normalizedCharacter.isMissing,
      normalizedCharacter.isRetired,
    ],
  );

  return normalizeCharacterRow(result.rows[0] ?? null);
}

async function upsertCharacterAttributes(attributes, options = {}) {
  if (
    !attributes ||
    typeof attributes !== 'object' ||
    Array.isArray(attributes)
  ) {
    return null;
  }

  const normalizedCharacterId = normalizeString(attributes.characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      INSERT INTO character_attributes (
        character_id,
        physique,
        comprehension,
        spirit,
        fortune,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (character_id) DO UPDATE SET
        physique = EXCLUDED.physique,
        comprehension = EXCLUDED.comprehension,
        spirit = EXCLUDED.spirit,
        fortune = EXCLUDED.fortune,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      normalizedCharacterId,
      normalizeNonNegativeInteger(attributes.physique, 0),
      normalizeNonNegativeInteger(attributes.comprehension, 0),
      normalizeNonNegativeInteger(attributes.spirit, 0),
      normalizeNonNegativeInteger(attributes.fortune, 0),
    ],
  );

  return normalizeCharacterAttributesRow(result.rows[0] ?? null);
}

async function upsertCharacterTalent(talent, options = {}) {
  if (!talent || typeof talent !== 'object' || Array.isArray(talent)) {
    return null;
  }

  const normalizedCharacterId = normalizeString(talent.characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      INSERT INTO character_talent (
        character_id,
        root_type,
        root_quality,
        special_constitution,
        affinity_primary,
        affinity_secondary,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (character_id) DO UPDATE SET
        root_type = EXCLUDED.root_type,
        root_quality = EXCLUDED.root_quality,
        special_constitution = EXCLUDED.special_constitution,
        affinity_primary = EXCLUDED.affinity_primary,
        affinity_secondary = EXCLUDED.affinity_secondary,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      normalizedCharacterId,
      normalizeString(talent.rootType, 'unknown'),
      normalizeNonNegativeInteger(talent.rootQuality, 0),
      talent.specialConstitution ?? null,
      talent.affinityPrimary ?? null,
      talent.affinitySecondary ?? null,
    ],
  );

  return normalizeCharacterTalentRow(result.rows[0] ?? null);
}

async function upsertCharacterCultivation(cultivation, options = {}) {
  if (
    !cultivation ||
    typeof cultivation !== 'object' ||
    Array.isArray(cultivation)
  ) {
    return null;
  }

  const normalizedCharacterId = normalizeString(cultivation.characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const normalizedEarnRateMultiplier = normalizeNonNegativeInteger(
    cultivation.earnRateMultiplier,
    1,
  );
  const spiritEnergy = normalizeNonNegativeInteger(
    cultivation.spiritEnergy ?? cultivation.qiCurrent,
    0,
  );
  const earnRateMultiplier = [1, 2, 3, 6, 12].includes(
    normalizedEarnRateMultiplier,
  )
    ? normalizedEarnRateMultiplier
    : 1;
  const result = await runner.query(
    `
      INSERT INTO character_cultivation (
        character_id,
        realm_index,
        stage,
        stage_progress,
        cultivation_base,
        spirit_energy,
        earn_rate_multiplier,
        breakthrough_preparation_state,
        qi_current,
        qi_quality,
        foundation_quality,
        breakthrough_failures,
        technique_slots,
        pill_counters,
        pill_buffs,
        last_progress_at,
        last_breakthrough_at,
        meditation_started_at,
        created_at,
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
        $15,
        $16,
        $17,
        $18,
        NOW(),
        NOW()
      )
      ON CONFLICT (character_id) DO UPDATE SET
        realm_index = EXCLUDED.realm_index,
        stage = EXCLUDED.stage,
        stage_progress = EXCLUDED.stage_progress,
        cultivation_base = EXCLUDED.cultivation_base,
        spirit_energy = EXCLUDED.spirit_energy,
        earn_rate_multiplier = EXCLUDED.earn_rate_multiplier,
        breakthrough_preparation_state = EXCLUDED.breakthrough_preparation_state,
        qi_current = EXCLUDED.spirit_energy,
        qi_quality = EXCLUDED.qi_quality,
        foundation_quality = EXCLUDED.foundation_quality,
        breakthrough_failures = EXCLUDED.breakthrough_failures,
        technique_slots = EXCLUDED.technique_slots,
        pill_counters = EXCLUDED.pill_counters,
        pill_buffs = EXCLUDED.pill_buffs,
        last_progress_at = EXCLUDED.last_progress_at,
        last_breakthrough_at = EXCLUDED.last_breakthrough_at,
        meditation_started_at = EXCLUDED.meditation_started_at,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      normalizedCharacterId,
      normalizeNullableNonNegativeInteger(cultivation.realmIndex, null),
      normalizeNonNegativeInteger(cultivation.stage, 0),
      normalizeNonNegativeInteger(cultivation.stageProgress, 0),
      normalizeNonNegativeInteger(cultivation.cultivationBase, 0),
      spiritEnergy,
      earnRateMultiplier,
      JSON.stringify(normalizeActionState(cultivation.breakthroughPreparationState)),
      spiritEnergy,
      normalizeNonNegativeInteger(cultivation.qiQuality, 0),
      normalizeNonNegativeInteger(cultivation.foundationQuality, 0),
      normalizeNonNegativeInteger(cultivation.breakthroughFailures, 0),
      JSON.stringify(normalizeTechniqueLoadout(cultivation.techniqueSlots)),
      JSON.stringify(normalizePillInventory(cultivation.pillCounters)),
      JSON.stringify(normalizeActivePillEffects(cultivation.pillBuffs)),
      cultivation.lastProgressAt ?? null,
      cultivation.lastBreakthroughAt ?? null,
      cultivation.meditationStartedAt ?? null,
    ],
  );

  return normalizeCharacterCultivationRow(result.rows[0] ?? null);
}

async function upsertCharacterStatus(status, options = {}) {
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    return null;
  }

  const normalizedCharacterId = normalizeString(status.characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      INSERT INTO character_status (
        character_id,
        hp_current,
        condition,
        state,
        meridian_state,
        dantian_state,
        mental_state,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (character_id) DO UPDATE SET
        hp_current = EXCLUDED.hp_current,
        condition = EXCLUDED.condition,
        state = EXCLUDED.state,
        meridian_state = EXCLUDED.meridian_state,
        dantian_state = EXCLUDED.dantian_state,
        mental_state = EXCLUDED.mental_state,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      normalizedCharacterId,
      normalizeNonNegativeInteger(status.hpCurrent, 0),
      normalizeString(status.condition, 'stable'),
      normalizeString(status.state, 'idle'),
      normalizeString(status.meridianState, 'stable'),
      normalizeString(status.dantianState, 'stable'),
      normalizeString(status.mentalState, 'calm'),
    ],
  );

  return normalizeCharacterStatusRow(result.rows[0] ?? null);
}

async function findCharacterAttributesByCharacterId(characterId, options = {}) {
  const normalizedCharacterId = normalizeString(characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM character_attributes
      WHERE character_id = $1
      LIMIT 1;
    `,
    [normalizedCharacterId],
  );

  return normalizeCharacterAttributesRow(result.rows[0] ?? null);
}

async function findCharacterTalentByCharacterId(characterId, options = {}) {
  const normalizedCharacterId = normalizeString(characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM character_talent
      WHERE character_id = $1
      LIMIT 1;
    `,
    [normalizedCharacterId],
  );

  return normalizeCharacterTalentRow(result.rows[0] ?? null);
}

async function findCharacterCultivationByCharacterId(
  characterId,
  options = {},
) {
  const normalizedCharacterId = normalizeString(characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM character_cultivation
      WHERE character_id = $1
      LIMIT 1;
    `,
    [normalizedCharacterId],
  );

  return normalizeCharacterCultivationRow(result.rows[0] ?? null);
}

async function findCharacterStatusByCharacterId(characterId, options = {}) {
  const normalizedCharacterId = normalizeString(characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT *
      FROM character_status
      WHERE character_id = $1
      LIMIT 1;
    `,
    [normalizedCharacterId],
  );

  return normalizeCharacterStatusRow(result.rows[0] ?? null);
}

async function getFullCharacterProfileByPlayerId(playerId, options = {}) {
  const normalizedPlayerId = normalizeString(playerId);
  if (!normalizedPlayerId) {
    return null;
  }

  const runner = resolveRunner(options);
  const result = await runner.query(
    `
      SELECT
        p.id AS player_id,
        p.discord_user_id,
        p.created_at AS player_created_at,
        p.updated_at AS player_updated_at,
        c.id AS character_id,
        c.name AS character_name,
        c.sex,
        c.age,
        c.lifespan_max,
        c.background_id,
        c.alignment,
        c.virtue,
        c.path,
        c.dao_focus,
        c.current_title_id,
        c.current_region_id,
        c.current_location_id,
        c.is_alive,
        c.is_sealed,
        c.is_missing,
        c.is_retired,
        c.created_at AS character_created_at,
        c.updated_at AS character_updated_at,
        a.physique,
        a.comprehension,
        a.spirit,
        a.fortune,
        a.created_at AS attributes_created_at,
        a.updated_at AS attributes_updated_at,
        t.root_type,
        t.root_quality,
        t.special_constitution,
        t.affinity_primary,
        t.affinity_secondary,
        t.created_at AS talent_created_at,
        t.updated_at AS talent_updated_at,
        cu.realm_index,
        cu.stage,
        cu.stage_progress,
        cu.cultivation_base,
        cu.spirit_energy,
        cu.earn_rate_multiplier,
        cu.breakthrough_preparation_state,
        cu.qi_current,
        cu.qi_quality,
        cu.foundation_quality,
        cu.last_progress_at,
        cu.last_breakthrough_at,
        cu.meditation_started_at,
        cu.breakthrough_failures,
        cu.technique_slots,
        cu.pill_counters,
        cu.pill_buffs,
        cu.created_at AS cultivation_created_at,
        cu.updated_at AS cultivation_updated_at,
        s.hp_current,
        s.condition,
        s.state,
        s.meridian_state,
        s.dantian_state,
        s.mental_state,
        s.created_at AS status_created_at,
        s.updated_at AS status_updated_at,
        bd.id AS background_definition_id,
        bd.key AS background_key,
        bd.name AS background_name,
        bd.description AS background_description,
        bd.physique_mod AS background_physique_mod,
        bd.comprehension_mod AS background_comprehension_mod,
        bd.spirit_mod AS background_spirit_mod,
        bd.fortune_mod AS background_fortune_mod,
        rd.name AS realm_name,
        rd.stage_max,
        rd.base_lifespan_bonus,
        rd.has_tribulation
      FROM players p
      JOIN characters c ON c.player_id = p.id
      LEFT JOIN character_attributes a ON a.character_id = c.id
      LEFT JOIN character_talent t ON t.character_id = c.id
      LEFT JOIN character_cultivation cu ON cu.character_id = c.id
      LEFT JOIN character_status s ON s.character_id = c.id
      LEFT JOIN background_definitions bd ON bd.id = c.background_id
      LEFT JOIN realm_definitions rd ON rd.realm_index = cu.realm_index
      WHERE p.id = $1
      LIMIT 1;
    `,
    [normalizedPlayerId],
  );

  return normalizeFullCharacterProfileRow(result.rows[0] ?? null);
}

module.exports = {
  createCharacterRecord,
  createPlayerRecord,
  findBackgroundDefinitionById,
  findBackgroundDefinitionByKey,
  findCharacterAttributesByCharacterId,
  findCharacterById,
  findCharacterByPlayerId,
  findCharacterCultivationByCharacterId,
  findCharacterStatusByCharacterId,
  findCharacterTalentByCharacterId,
  findPlayerByDiscordUserId,
  findPlayerById,
  findRealmDefinitionByIndex,
  getFullCharacterProfileByPlayerId,
  listBackgroundDefinitions,
  listRealmDefinitions,
  clearCultivationReferenceCache,
  normalizeBackgroundDefinitionRow,
  normalizeCharacterAttributesRow,
  normalizeCharacterCultivationRow,
  normalizeCharacterRow,
  normalizeCharacterStatusRow,
  normalizeCharacterTalentRow,
  normalizeFullCharacterProfileRow,
  normalizePlayerRow,
  normalizeRealmDefinitionRow,
  upsertCharacterAttributes,
  upsertCharacterCultivation,
  upsertCharacterStatus,
  upsertCharacterTalent,
};
