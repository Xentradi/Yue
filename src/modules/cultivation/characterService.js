const { randomUUID } = require('node:crypto');
const { withTransaction } = require('../../storage/postgres');
const {
  createCharacterRecord,
  findBackgroundDefinitionById,
  findBackgroundDefinitionByKey,
  findCharacterByPlayerId,
  findCharacterById,
  findPlayerById,
  findRealmDefinitionByIndex,
  upsertCharacterAttributes,
  upsertCharacterCultivation,
  upsertCharacterStatus,
  upsertCharacterTalent,
} = require('../../storage/cultivationRepository');
const {
  normalizeActionState,
  normalizePillInventory,
  normalizeTechniqueLoadout,
} = require('./loadoutCatalog');
const { ensurePlayerByDiscordUserId } = require('./playerService');
const { buildProfileForPlayerId } = require('./profileService');

const DEFAULT_BACKGROUND_KEY = 'commoner';
const PATH_TO_ROOT_TYPE = {
  body: 'body',
  qi: 'qi',
  balanced: 'balanced',
};

function resolveNormalizedPlayerId(playerId) {
  return typeof playerId === 'string'
    ? playerId.trim()
    : (playerId?.id?.trim?.() ?? '');
}

function normalizePath(path) {
  if (typeof path !== 'string') {
    return 'balanced';
  }

  const normalizedPath = path.trim();
  return ['body', 'qi', 'balanced'].includes(normalizedPath)
    ? normalizedPath
    : 'balanced';
}

function normalizeCharacterInput(character = {}) {
  return {
    name: typeof character.name === 'string' ? character.name.trim() : '',
    sex: character.sex ?? null,
    age: Number.isFinite(Number(character.age))
      ? Math.max(0, Math.trunc(Number(character.age)))
      : 0,
    lifespanMax: Number.isFinite(Number(character.lifespanMax))
      ? Math.max(0, Math.trunc(Number(character.lifespanMax)))
      : 0,
    backgroundId: character.backgroundId ?? null,
    backgroundKey:
      typeof character.backgroundKey === 'string'
        ? character.backgroundKey.trim()
        : '',
    alignment:
      typeof character.alignment === 'string'
        ? character.alignment.trim()
        : 'neutral',
    virtue: Number.isFinite(Number(character.virtue))
      ? Math.max(0, Math.trunc(Number(character.virtue)))
      : 0,
    path: normalizePath(character.path),
    daoFocus: character.daoFocus ?? null,
    currentTitleId: character.currentTitleId ?? null,
    currentRegionId: character.currentRegionId ?? null,
    currentLocationId: character.currentLocationId ?? null,
    isAlive:
      character.isAlive !== undefined ? Boolean(character.isAlive) : true,
    isSealed:
      character.isSealed !== undefined ? Boolean(character.isSealed) : false,
    isMissing:
      character.isMissing !== undefined ? Boolean(character.isMissing) : false,
    isRetired:
      character.isRetired !== undefined ? Boolean(character.isRetired) : false,
    attributes: {
      physique: Number.isFinite(Number(character.attributes?.physique))
        ? Math.max(0, Math.trunc(Number(character.attributes.physique)))
        : null,
      comprehension: Number.isFinite(
        Number(character.attributes?.comprehension),
      )
        ? Math.max(0, Math.trunc(Number(character.attributes.comprehension)))
        : null,
      spirit: Number.isFinite(Number(character.attributes?.spirit))
        ? Math.max(0, Math.trunc(Number(character.attributes.spirit)))
        : null,
      fortune: Number.isFinite(Number(character.attributes?.fortune))
        ? Math.max(0, Math.trunc(Number(character.attributes.fortune)))
        : null,
    },
    talent: {
      rootType:
        typeof character.talent?.rootType === 'string'
          ? character.talent.rootType.trim()
          : '',
      rootQuality: Number.isFinite(Number(character.talent?.rootQuality))
        ? Math.max(0, Math.trunc(Number(character.talent.rootQuality)))
        : null,
      specialConstitution: character.talent?.specialConstitution ?? null,
      affinityPrimary: character.talent?.affinityPrimary ?? null,
      affinitySecondary: character.talent?.affinitySecondary ?? null,
    },
    cultivation: {
      realmIndex: Number.isFinite(Number(character.cultivation?.realmIndex))
        ? Math.max(1, Math.trunc(Number(character.cultivation.realmIndex)))
        : null,
      stage: Number.isFinite(Number(character.cultivation?.stage))
        ? Math.max(0, Math.trunc(Number(character.cultivation.stage)))
        : null,
      stageProgress: Number.isFinite(
        Number(character.cultivation?.stageProgress),
      )
        ? Math.max(0, Math.trunc(Number(character.cultivation.stageProgress)))
        : null,
      cultivationBase: Number.isFinite(
        Number(character.cultivation?.cultivationBase),
      )
        ? Math.max(0, Math.trunc(Number(character.cultivation.cultivationBase)))
        : null,
      qiCurrent: Number.isFinite(Number(character.cultivation?.qiCurrent))
        ? Math.max(0, Math.trunc(Number(character.cultivation.qiCurrent)))
        : null,
      qiQuality: Number.isFinite(Number(character.cultivation?.qiQuality))
        ? Math.max(0, Math.trunc(Number(character.cultivation.qiQuality)))
        : null,
      foundationQuality: Number.isFinite(
        Number(character.cultivation?.foundationQuality),
      )
        ? Math.max(
            0,
            Math.trunc(Number(character.cultivation.foundationQuality)),
          )
        : null,
      spiritEnergy: Number.isFinite(Number(character.cultivation?.spiritEnergy))
        ? Math.max(0, Math.trunc(Number(character.cultivation.spiritEnergy)))
        : null,
      breakthroughPreparationState:
        character.cultivation?.breakthroughPreparationState ?? null,
      techniqueSlots: Array.isArray(character.cultivation?.techniqueSlots)
        ? character.cultivation.techniqueSlots
        : null,
      pillCounters:
        character.cultivation?.pillCounters &&
        typeof character.cultivation.pillCounters === 'object'
          ? character.cultivation.pillCounters
          : null,
      pillBuffs: Array.isArray(character.cultivation?.pillBuffs)
        ? character.cultivation.pillBuffs
        : null,
      lastBreakthroughAt: character.cultivation?.lastBreakthroughAt ?? null,
    },
    status: {
      hpCurrent: Number.isFinite(Number(character.status?.hpCurrent))
        ? Math.max(0, Math.trunc(Number(character.status.hpCurrent)))
        : null,
      condition:
        typeof character.status?.condition === 'string'
          ? character.status.condition.trim()
          : '',
      state:
        typeof character.status?.state === 'string'
          ? character.status.state.trim()
          : '',
      meridianState:
        typeof character.status?.meridianState === 'string'
          ? character.status.meridianState.trim()
          : '',
      dantianState:
        typeof character.status?.dantianState === 'string'
          ? character.status.dantianState.trim()
          : '',
      mentalState:
        typeof character.status?.mentalState === 'string'
          ? character.status.mentalState.trim()
          : '',
    },
  };
}

function normalizeBaseAttributes(background = {}, overrides = {}) {
  const base = {
    physique: 1,
    comprehension: 1,
    spirit: 1,
    fortune: 1,
  };

  return {
    physique: Math.max(
      0,
      (overrides.physique ?? base.physique) + (background.physiqueMod ?? 0),
    ),
    comprehension: Math.max(
      0,
      (overrides.comprehension ?? base.comprehension) +
        (background.comprehensionMod ?? 0),
    ),
    spirit: Math.max(
      0,
      (overrides.spirit ?? base.spirit) + (background.spiritMod ?? 0),
    ),
    fortune: Math.max(
      0,
      (overrides.fortune ?? base.fortune) + (background.fortuneMod ?? 0),
    ),
  };
}

function buildDefaultTalent(normalizedCharacter, background = {}) {
  const pathRootType =
    PATH_TO_ROOT_TYPE[normalizedCharacter.path] ?? 'balanced';
  const backgroundWeight = Math.max(
    0,
    (background.physiqueMod ?? 0) +
      (background.comprehensionMod ?? 0) +
      (background.spiritMod ?? 0) +
      (background.fortuneMod ?? 0),
  );
  const defaultRootQuality = Math.max(1, 1 + Math.floor(backgroundWeight / 2));

  return {
    rootType: normalizedCharacter.talent.rootType || pathRootType,
    rootQuality: normalizedCharacter.talent.rootQuality ?? defaultRootQuality,
    specialConstitution: normalizedCharacter.talent.specialConstitution ?? null,
    affinityPrimary:
      normalizedCharacter.talent.affinityPrimary ??
      (normalizedCharacter.path === 'body' ? 'earth' : 'water'),
    affinitySecondary:
      normalizedCharacter.talent.affinitySecondary ??
      (normalizedCharacter.path === 'qi' ? 'wind' : 'metal'),
  };
}

function buildDefaultCultivation(normalizedCharacter, background = {}) {
  const normalizedTechniqueSlots = normalizeTechniqueLoadout(
    normalizedCharacter.cultivation.techniqueSlots,
  );
  const starterTechnique = normalizedTechniqueSlots[0] ?? 'ember-breath-manual';
  const starterPills = {
    'awakening-draught': 1,
  };

  return {
    realmIndex: normalizedCharacter.cultivation.realmIndex ?? null,
    stage: normalizedCharacter.cultivation.stage ?? 0,
    stageProgress: normalizedCharacter.cultivation.stageProgress ?? 0,
    cultivationBase: normalizedCharacter.cultivation.cultivationBase ?? 0,
    earnRateMultiplier: normalizedCharacter.cultivation.earnRateMultiplier ?? 1,
    spiritEnergy:
      normalizedCharacter.cultivation.spiritEnergy ??
      normalizedCharacter.cultivation.qiCurrent ??
      0,
    qiCurrent:
      normalizedCharacter.cultivation.spiritEnergy ??
      normalizedCharacter.cultivation.qiCurrent ??
      0,
    qiQuality:
      normalizedCharacter.cultivation.qiQuality ??
      Math.max(
        0,
        (normalizedCharacter.talent.rootQuality ?? 1) +
          Math.max(0, background.comprehensionMod ?? 0),
      ),
    foundationQuality:
      normalizedCharacter.cultivation.foundationQuality ??
      Math.max(0, background.fortuneMod ?? 0),
    breakthroughFailures:
      normalizedCharacter.cultivation.breakthroughFailures ?? 0,
    breakthroughPreparationState:
      normalizeActionState(
        normalizedCharacter.cultivation.breakthroughPreparationState,
      ),
    techniqueSlots:
      normalizedTechniqueSlots.length > 0
        ? normalizedTechniqueSlots
        : [starterTechnique],
    pillCounters:
      Object.keys(
        normalizePillInventory(normalizedCharacter.cultivation.pillCounters),
      ).length > 0
        ? normalizePillInventory(normalizedCharacter.cultivation.pillCounters)
        : starterPills,
    pillBuffs: Array.isArray(normalizedCharacter.cultivation.pillBuffs)
      ? normalizedCharacter.cultivation.pillBuffs
      : [],
    lastProgressAt:
      normalizedCharacter.cultivation.lastProgressAt ??
      new Date().toISOString(),
    lastBreakthroughAt:
      normalizedCharacter.cultivation.lastBreakthroughAt ?? null,
  };
}

function buildDefaultStatus(
  normalizedCharacter,
  attributes = {},
  cultivation = {},
) {
  const hpSeed = Math.max(
    1,
    attributes.physique * 10 + attributes.spirit * 2 + cultivation.stage * 5,
  );

  return {
    hpCurrent: normalizedCharacter.status.hpCurrent ?? hpSeed,
    condition: normalizedCharacter.status.condition || 'stable',
    state: normalizedCharacter.status.state || 'idle',
    meridianState: normalizedCharacter.status.meridianState || 'stable',
    dantianState: normalizedCharacter.status.dantianState || 'stable',
    mentalState: normalizedCharacter.status.mentalState || 'calm',
  };
}

async function resolveBackgroundDefinition(normalizedCharacter, options = {}) {
  if (normalizedCharacter.backgroundId) {
    const backgroundById = await findBackgroundDefinitionById(
      normalizedCharacter.backgroundId,
      options,
    );
    if (backgroundById) {
      return backgroundById;
    }
  }

  if (normalizedCharacter.backgroundKey) {
    const backgroundByKey = await findBackgroundDefinitionByKey(
      normalizedCharacter.backgroundKey,
      options,
    );
    if (backgroundByKey) {
      return backgroundByKey;
    }
  }

  return await findBackgroundDefinitionByKey(DEFAULT_BACKGROUND_KEY, options);
}

async function createCharacterForPlayer(
  playerId,
  character = {},
  options = {},
) {
  const normalizedPlayerId = resolveNormalizedPlayerId(playerId);
  if (!normalizedPlayerId) {
    return null;
  }

  const player = await findPlayerById(normalizedPlayerId, options);
  if (!player) {
    return null;
  }

  const normalizedCharacter = normalizeCharacterInput(character);
  if (!normalizedCharacter.name) {
    throw new Error('Character name is required.');
  }

  const runCreate = async (client) => {
    const realm = await findRealmDefinitionByIndex(
      normalizedCharacter.cultivation.realmIndex ?? 1,
      { client },
    );

    if (!realm) {
      throw new Error(
        `Missing realm definition for index ${normalizedCharacter.cultivation.realmIndex ?? 1}.`,
      );
    }

    const background = await resolveBackgroundDefinition(normalizedCharacter, {
      client,
    });

    const createdCharacter = await createCharacterRecord(
      {
        id: randomUUID(),
        playerId: normalizedPlayerId,
        name: normalizedCharacter.name,
        sex: normalizedCharacter.sex,
        age: normalizedCharacter.age,
        lifespanMax: normalizedCharacter.lifespanMax,
        backgroundId: background?.id ?? normalizedCharacter.backgroundId,
        alignment: normalizedCharacter.alignment,
        virtue: normalizedCharacter.virtue,
        path: normalizedCharacter.path,
        daoFocus: normalizedCharacter.daoFocus,
        currentTitleId: normalizedCharacter.currentTitleId,
        currentRegionId: normalizedCharacter.currentRegionId,
        currentLocationId: normalizedCharacter.currentLocationId,
        isAlive: normalizedCharacter.isAlive,
        isSealed: normalizedCharacter.isSealed,
        isMissing: normalizedCharacter.isMissing,
        isRetired: normalizedCharacter.isRetired,
      },
      { client },
    );

    if (!createdCharacter) {
      throw new Error('Character already exists for this player.');
    }

    const attributes = normalizeBaseAttributes(
      background ?? {},
      normalizedCharacter.attributes,
    );
    const talent = buildDefaultTalent(normalizedCharacter, background ?? {});
    const cultivation = buildDefaultCultivation(
      normalizedCharacter,
      background ?? {},
    );
    const status = buildDefaultStatus(
      normalizedCharacter,
      attributes,
      cultivation,
    );

    await upsertCharacterAttributes(
      {
        characterId: createdCharacter.id,
        ...attributes,
      },
      { client },
    );
    await upsertCharacterTalent(
      {
        characterId: createdCharacter.id,
        ...talent,
      },
      { client },
    );
    await upsertCharacterCultivation(
      {
        characterId: createdCharacter.id,
        ...cultivation,
      },
      { client },
    );
    await upsertCharacterStatus(
      {
        characterId: createdCharacter.id,
        ...status,
      },
      { client },
    );

    return await buildProfileForPlayerId(normalizedPlayerId, { client });
  };

  if (options.client) {
    return await runCreate(options.client);
  }

  return await withTransaction(runCreate);
}

async function ensureCharacterForDiscordUserId(
  discordUserId,
  character = {},
  options = {},
) {
  const normalizedDiscordUserId =
    typeof discordUserId === 'string' ? discordUserId.trim() : '';
  if (!normalizedDiscordUserId) {
    return null;
  }

  const ensuredPlayer = await ensurePlayerByDiscordUserId(
    normalizedDiscordUserId,
    options,
  );
  if (!ensuredPlayer) {
    return null;
  }

  const existing = await findCharacterByPlayerId(ensuredPlayer.id, options);
  if (existing) {
    return await buildProfileForPlayerId(ensuredPlayer.id, options);
  }

  try {
    return await createCharacterForPlayer(ensuredPlayer.id, character, options);
  } catch (error) {
    if (
      error instanceof Error &&
      /already exists for this player/i.test(error.message)
    ) {
      return await buildProfileForPlayerId(ensuredPlayer.id, options);
    }

    throw error;
  }
}

async function getCharacterByPlayerId(playerId, options = {}) {
  const normalizedPlayerId = resolveNormalizedPlayerId(playerId);
  if (!normalizedPlayerId) {
    return null;
  }

  return await findCharacterByPlayerId(normalizedPlayerId, options);
}

async function getCharacterById(characterId, options = {}) {
  const normalizedCharacterId = resolveNormalizedPlayerId(characterId);
  if (!normalizedCharacterId) {
    return null;
  }

  return await findCharacterById(normalizedCharacterId, options);
}

module.exports = {
  createCharacterForPlayer,
  ensureCharacterForDiscordUserId,
  getCharacterById,
  getCharacterByPlayerId,
  normalizeCharacterInput,
  resolveNormalizedPlayerId,
};
