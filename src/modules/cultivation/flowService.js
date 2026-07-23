const {
  findRealmDefinitionByIndex,
  upsertCharacterCultivation,
  upsertCharacterStatus,
} = require('../../storage/cultivationRepository');
const {
  calculateDerivedCharacterStats,
  normalizeNumber,
} = require('./derivedStatsService');
const { getFullCharacterProfile } = require('./profileService');
const { ensurePlayerByDiscordUserId } = require('./playerService');
const { createCharacterForPlayer } = require('./characterService');
const { calculateBreakthroughOutcome } = require('./cultivationService');
const { getCultivationRequirement } = require('./requirements');
const {
  getPillDefinition,
  normalizeActionState,
  normalizeActivePillEffects,
  normalizePillInventory,
  normalizeTechniqueLoadout,
  summarizeActivePillEffects,
  summarizePreparationEffects,
  summarizeTechniqueEffects,
} = require('./loadoutCatalog');

const PASSIVE_TICK_MS = 5000;
const MEDITATION_TICK_GAIN_RANGE = { min: 6, max: 8 };
const INSIGHT_BURST_GAIN_RANGE = { min: 8, max: 14 };
const CULTIVATION_EARN_RATE_MULTIPLIERS = new Set([1, 2, 3, 6, 12]);
const ACTIVE_REWARD_BANDS = {
  steady: { min: 24, max: 28 },
  focused: { min: 29, max: 33 },
  aggressive: { min: 34, max: 40 },
};
const PERFORMANCE_BONUS = {
  poor: -5,
  normal: 0,
  good: 4,
  excellent: 14,
};
const ACTIVE_MODE_FACTORS = {
  steady: { risk: 0.35 },
  focused: { risk: 0.6 },
  aggressive: { risk: 1 },
};

const MINIGAME_TYPES = ['timing', 'memory', 'risk'];
const meditationSessions = new Map();

function resolveProfileInput(input) {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    return { discordUserId: input };
  }

  if (input.discordUserId || input.playerId) {
    return input;
  }

  return null;
}

function registerMeditationSession(discordUserId, stopSession) {
  if (!discordUserId || typeof stopSession !== 'function') {
    return;
  }

  meditationSessions.set(discordUserId, stopSession);
}

function clearMeditationSession(discordUserId) {
  meditationSessions.delete(discordUserId);
}

async function stopActiveMeditationSession(discordUserId, summary) {
  const stopSession = meditationSessions.get(discordUserId);
  if (typeof stopSession !== 'function') {
    clearMeditationSession(discordUserId);
    return null;
  }

  clearMeditationSession(discordUserId);
  return await stopSession(summary);
}

function mergeCultivationProfile(profile, cultivation, status) {
  const merged = {
    ...profile,
    cultivation: cultivation
      ? { ...profile.cultivation, ...cultivation }
      : profile.cultivation,
    status: status ? { ...profile.status, ...status } : profile.status,
  };

  if (cultivation?.realmIndex !== undefined) {
    const realmIndex = normalizeNumber(cultivation.realmIndex);
    merged.realm =
      profile.realm?.realmIndex === realmIndex
        ? { ...profile.realm }
        : profile.realm;
  }

  merged.derived = calculateDerivedCharacterStats(merged);
  return merged;
}

function toDate(value, fallback = new Date()) {
  if (!value) {
    return new Date(fallback);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

function clampInteger(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeCultivationEarnRateMultiplier(value, fallback = 1) {
  const parsed = normalizeNumber(value, fallback);
  const normalized = Math.trunc(parsed);
  return CULTIVATION_EARN_RATE_MULTIPLIERS.has(normalized)
    ? normalized
    : fallback;
}

function getCultivationEarnRateMultiplier(profile = {}) {
  return normalizeCultivationEarnRateMultiplier(
    profile.cultivation?.earnRateMultiplier,
    1,
  );
}

function applyCultivationEarnRate(value, multiplier) {
  const parsedValue = Math.max(0, Math.trunc(value));
  const parsedMultiplier = normalizeCultivationEarnRateMultiplier(
    multiplier,
    1,
  );
  return Math.max(0, Math.floor(parsedValue * parsedMultiplier));
}

function getCultivationSpiritEnergy(cultivation = {}) {
  return normalizeNumber(cultivation.spiritEnergy ?? cultivation.qiCurrent, 0);
}

function getCultivationLoadoutSummary(profile = {}) {
  const cultivation = profile.cultivation ?? {};
  const techniqueSummary = summarizeTechniqueEffects(
    cultivation.techniqueSlots ?? [],
  );
  const preparationSummary = summarizePreparationEffects(
    cultivation.breakthroughPreparationState ?? {},
  );
  const pillSummary = summarizeActivePillEffects(
    cultivation.pillBuffs ?? [],
    new Date(),
  );

  return {
    techniqueSummary,
    preparationSummary,
    pillSummary,
    cultivationBaseMultiplier:
      techniqueSummary.cultivationBaseMultiplier +
      preparationSummary.cultivationBaseMultiplier,
    breakthroughChanceBonus:
      techniqueSummary.breakthroughChanceBonus +
      preparationSummary.breakthroughChanceBonus +
      pillSummary.breakthroughChanceBonus,
    spiritEfficiencyBonus:
      techniqueSummary.spiritEfficiencyBonus +
      preparationSummary.spiritEfficiencyBonus +
      pillSummary.spiritEfficiencyBonus,
    failurePenaltyReduction:
      preparationSummary.failurePenaltyReduction +
      pillSummary.failurePenaltyReduction,
    pillCultivationBaseGain: pillSummary.cultivationBaseGain,
  };
}

function getCultivationLoadoutState(cultivation = {}) {
  return {
    breakthroughPreparationState: normalizeActionState(
      cultivation.breakthroughPreparationState ?? {},
    ),
    techniqueSlots: normalizeTechniqueLoadout(cultivation.techniqueSlots ?? []),
    pillCounters: normalizePillInventory(cultivation.pillCounters ?? {}),
    pillBuffs: normalizeActivePillEffects(cultivation.pillBuffs ?? [], new Date()),
  };
}

function buildPersistCultivationPayload(profile, outcome = {}, overrides = {}) {
  const loadoutState = getCultivationLoadoutState(profile.cultivation ?? {});
  const currentCultivation = profile.cultivation ?? {};
  const resolvedSpiritEnergy = Math.max(
    0,
    overrides.spiritEnergy ??
      outcome.spiritEnergy ??
      outcome.qiCurrent ??
      getCultivationSpiritEnergy(currentCultivation),
  );

  return {
    characterId: profile.character.id,
    realmIndex:
      overrides.realmIndex !== undefined
        ? overrides.realmIndex
        : (outcome.realmIndex !== undefined
            ? outcome.realmIndex
            : (currentCultivation.realmIndex ?? null)),
    stage: overrides.stage ?? outcome.stage ?? currentCultivation.stage,
    stageProgress:
      overrides.stageProgress ??
      outcome.stageProgress ??
      currentCultivation.stageProgress,
    cultivationBase:
      clampCultivationBase(
        profile,
        overrides.cultivationBase ??
          outcome.cultivationBase ??
          currentCultivation.cultivationBase,
      ),
    spiritEnergy: resolvedSpiritEnergy,
    qiCurrent: resolvedSpiritEnergy,
    earnRateMultiplier:
      overrides.earnRateMultiplier ??
      currentCultivation.earnRateMultiplier ??
      1,
    qiQuality: currentCultivation.qiQuality,
    foundationQuality: currentCultivation.foundationQuality,
    breakthroughFailures:
      overrides.breakthroughFailures ??
      outcome.breakthroughFailures ??
      currentCultivation.breakthroughFailures ??
      0,
    breakthroughPreparationState:
      overrides.breakthroughPreparationState ??
      loadoutState.breakthroughPreparationState,
    techniqueSlots:
      overrides.techniqueSlots ?? loadoutState.techniqueSlots ?? [],
    pillCounters: overrides.pillCounters ?? loadoutState.pillCounters ?? {},
    pillBuffs: overrides.pillBuffs ?? loadoutState.pillBuffs ?? [],
    lastProgressAt:
      overrides.lastProgressAt ??
      outcome.lastProgressAt ??
      currentCultivation.lastProgressAt ??
      new Date().toISOString(),
    lastBreakthroughAt:
      overrides.lastBreakthroughAt ??
      outcome.lastBreakthroughAt ??
      currentCultivation.lastBreakthroughAt ??
      null,
    meditationStartedAt:
      overrides.meditationStartedAt !== undefined
        ? overrides.meditationStartedAt
        : (currentCultivation.meditationStartedAt ?? null),
  };
}

function getCultivationBaseCap(profile = {}) {
  const required = getCultivationRequirement(profile);
  return Math.max(required, Math.floor(required * 1.8));
}

function clampCultivationBase(profile = {}, value = 0) {
  const normalized = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
  return Math.max(0, Math.min(normalized, getCultivationBaseCap(profile)));
}

function applyLoadoutGain(value, loadoutMultiplier = 0, bonusValue = 0) {
  const parsedValue = Math.max(0, Math.trunc(value));
  const multiplier = 1 + Math.max(0, loadoutMultiplier);
  return Math.max(
    0,
    Math.floor(parsedValue * multiplier + Math.max(0, bonusValue)),
  );
}

function pickRangeValue(range, random = Math.random) {
  const source = typeof random === 'function' ? random : Math.random;
  const value = Number(source());
  const normalized = Number.isFinite(value)
    ? Math.max(0, Math.min(0.999999, value))
    : 0;
  return range.min + Math.floor(normalized * (range.max - range.min + 1));
}

function splitCultivationGain(totalGain, derived = {}) {
  const normalizedTotal = Math.max(0, Math.trunc(totalGain));
  const progressFloor = Math.max(10, Math.floor(normalizedTotal * 0.58));
  const progressBoost = Math.floor((derived.effectiveSpirit ?? 0) / 6);
  const progressGain = Math.max(
    8,
    Math.min(normalizedTotal - 1, progressFloor + progressBoost),
  );
  const cultivationBaseGain = Math.max(1, normalizedTotal - progressGain);

  return {
    progressGain,
    cultivationBaseGain,
    cultivationGain: progressGain + cultivationBaseGain,
  };
}

function calculatePassiveProgressOutcome(profile = {}, options = {}) {
  const cultivation = profile.cultivation ?? {};
  const derived = calculateDerivedCharacterStats(profile);
  const rateMultiplier = getCultivationEarnRateMultiplier(profile);
  const now = toDate(options.now ?? new Date());
  const lastProgressAt = toDate(
    cultivation.lastProgressAt ?? cultivation.updatedAt ?? now,
    now,
  );
  const elapsedMs = Math.max(
    0,
    Number(options.elapsedMs ?? now.getTime() - lastProgressAt.getTime()),
  );
  const ticks = Math.floor(elapsedMs / PASSIVE_TICK_MS);
  const consumedMs = ticks * PASSIVE_TICK_MS;
  const consumedAt = new Date(lastProgressAt.getTime() + consumedMs);
  const isMeditating = Boolean(cultivation.meditationStartedAt);
  const baseTickGain = clampInteger(
    Math.floor(
      (derived.effectiveSpirit +
        derived.effectiveComprehension +
        derived.effectiveAttributeAverage) /
        5,
    ),
    MEDITATION_TICK_GAIN_RANGE.min,
    MEDITATION_TICK_GAIN_RANGE.max,
    MEDITATION_TICK_GAIN_RANGE.min,
  );
  const rawProgressGain = Math.max(0, ticks * baseTickGain);
  const progressGain = applyCultivationEarnRate(
    rawProgressGain,
    rateMultiplier,
  );
  const cultivationBaseGain = applyCultivationEarnRate(
    Math.max(0, Math.floor(rawProgressGain / 2 + derived.effectiveSpirit / 8)),
    rateMultiplier,
  );
  const loadout = getCultivationLoadoutSummary(profile);
  const enhancedCultivationBaseGain = applyLoadoutGain(
    cultivationBaseGain,
    loadout.cultivationBaseMultiplier,
    loadout.pillCultivationBaseGain,
  );
  const cultivationGain = progressGain + enhancedCultivationBaseGain;
  const qiGain = applyCultivationEarnRate(
    Math.max(
      0,
      Math.floor(rawProgressGain / 2 + derived.effectiveComprehension / 8),
    ),
    rateMultiplier,
  );
  const enhancedQiGain = applyLoadoutGain(
    qiGain,
    loadout.spiritEfficiencyBonus,
  );
  const nextAccumulation = clampCultivationBase(
    profile,
    normalizeNumber(cultivation.cultivationBase) + cultivationGain,
  );
  const nextStageProgress =
    normalizeNumber(cultivation.stageProgress) + cultivationGain;

  return {
    derived,
    elapsedMs,
    ticks,
    isMeditating,
    progressGain,
    cultivationBaseGain: enhancedCultivationBaseGain,
    cultivationGain,
    qiGain: enhancedQiGain,
    stage: normalizeNumber(cultivation.stage, 0),
    stageProgress: nextStageProgress,
    cultivationBase: nextAccumulation,
    spiritEnergy: getCultivationSpiritEnergy(cultivation) + enhancedQiGain,
    qiCurrent: getCultivationSpiritEnergy(cultivation) + enhancedQiGain,
    breakthroughs: 0,
    lastProgressAt:
      consumedMs > 0 ? consumedAt.toISOString() : lastProgressAt.toISOString(),
    statusState: profile.status?.state ?? null,
  };
}

function calculateMeditationTickOutcome(profile = {}, options = {}) {
  const baseOutcome = calculatePassiveProgressOutcome(profile, {
    ...options,
    elapsedMs: PASSIVE_TICK_MS,
  });
  const derived = baseOutcome.derived;
  const rateMultiplier = getCultivationEarnRateMultiplier(profile);
  const meter = Math.max(0, Number(options.insightMeter ?? 0));
  const insightChance =
    meter >= 60
      ? 1
      : Math.max(
          0.00001,
          Math.min(
            0.95,
            0.00001 + meter * 0.0175 + derived.effectiveSpirit / 1000,
          ),
        );
  const insightRoll = Number.isFinite(options.roll)
    ? Math.max(0, Math.min(1, Number(options.roll)))
    : Math.random();
  const insightProc = insightRoll <= insightChance;
  const insightProgressGain = insightProc
    ? clampInteger(
        Math.floor(
          INSIGHT_BURST_GAIN_RANGE.min +
            derived.effectiveComprehension / 3 +
            meter / 24,
        ),
        INSIGHT_BURST_GAIN_RANGE.min,
        INSIGHT_BURST_GAIN_RANGE.max,
        INSIGHT_BURST_GAIN_RANGE.min,
      )
    : 0;
  const insightQiGain = insightProc
    ? clampInteger(
        Math.floor(3 + derived.effectiveSpirit / 4 + meter / 30),
        3,
        8,
        3,
      )
    : 0;
  const scaledInsightProgressGain = applyCultivationEarnRate(
    insightProgressGain,
    rateMultiplier,
  );
  const scaledInsightQiGain = applyCultivationEarnRate(
    insightQiGain,
    rateMultiplier,
  );
  const progressGain = baseOutcome.progressGain + scaledInsightProgressGain;
  const enhancedCultivationGain =
    baseOutcome.cultivationGain + scaledInsightProgressGain;
  const enhancedQiGain = baseOutcome.qiGain + scaledInsightQiGain;
  const nextAccumulation = clampCultivationBase(
    profile,
    normalizeNumber(profile.cultivation?.cultivationBase) + enhancedCultivationGain,
  );
  const nextStageProgress =
    normalizeNumber(profile.cultivation?.stageProgress) + enhancedCultivationGain;

  return {
    ...baseOutcome,
    insightRoll,
    insightProc,
    insightProgressGain,
    insightQiGain,
    progressGain,
    cultivationGain: enhancedCultivationGain,
    qiGain: enhancedQiGain,
    stage: normalizeNumber(profile.cultivation?.stage, 0),
    stageProgress: nextStageProgress,
    cultivationBase: nextAccumulation,
    spiritEnergy:
      getCultivationSpiritEnergy(profile.cultivation) + enhancedQiGain,
    qiCurrent: getCultivationSpiritEnergy(profile.cultivation) + enhancedQiGain,
    nextInsightMeter: insightProc ? 0 : meter + 1,
  };
}

async function persistPassiveProgress(profile, options = {}) {
  const outcome = calculatePassiveProgressOutcome(profile, options);
  const cultivation = profile.cultivation ?? {};
  const shouldPersist =
    outcome.ticks > 0 ||
    options.force === true ||
    options.meditationStartedAt !== undefined ||
    options.clearMeditation === true;

  if (!shouldPersist) {
    return {
      profile: mergeCultivationProfile(profile, cultivation),
      outcome,
    };
  }

  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(profile, outcome, {
      lastProgressAt: outcome.lastProgressAt,
      meditationStartedAt:
        options.meditationStartedAt !== undefined
          ? options.meditationStartedAt
          : (profile.cultivation.meditationStartedAt ?? null),
    }),
    options,
  );

  return {
    profile: mergeCultivationProfile(profile, updatedCultivation),
    outcome,
  };
}

async function persistCultivationOutcome(profile, outcome, options = {}) {
  if (!profile?.character?.id || !profile?.cultivation) {
    return null;
  }

  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(profile, outcome, {
      realmIndex:
        outcome.realmIndex !== undefined
          ? outcome.realmIndex
          : (profile.cultivation.realmIndex ?? null),
      meditationStartedAt:
        options.meditationStartedAt !== undefined
          ? options.meditationStartedAt
          : (profile.cultivation.meditationStartedAt ?? null),
    }),
    options,
  );

  let updatedProfile = mergeCultivationProfile(profile, updatedCultivation);

  if (updatedCultivation?.realmIndex !== profile.cultivation?.realmIndex) {
    updatedProfile.realm =
      (await findRealmDefinitionByIndex(
        updatedCultivation.realmIndex,
        options,
      )) ?? updatedProfile.realm;
    updatedProfile.derived = calculateDerivedCharacterStats(updatedProfile);
  }

  if (outcome.statusCondition || outcome.statusState) {
    const updatedStatus = await upsertCharacterStatus(
      {
        characterId: profile.character.id,
        hpCurrent: profile.status?.hpCurrent ?? 0,
        condition:
          outcome.statusCondition ?? profile.status?.condition ?? 'stable',
        state: outcome.statusState ?? profile.status?.state ?? 'idle',
        meridianState: profile.status?.meridianState ?? 'stable',
        dantianState: profile.status?.dantianState ?? 'stable',
        mentalState: profile.status?.mentalState ?? 'calm',
      },
      options,
    );

    updatedProfile = mergeCultivationProfile(
      updatedProfile,
      null,
      updatedStatus,
    );
  }

  return {
    profile: updatedProfile,
    outcome,
  };
}

async function refreshCultivationProfile(input, options = {}) {
  const resolved = resolveProfileInput(input);
  if (!resolved) {
    return null;
  }

  const profile = await getFullCharacterProfile(resolved, options);
  if (!profile?.character) {
    return null;
  }

  const refreshed = await persistPassiveProgress(profile, options);
  return refreshed.profile;
}

async function createCultivatorForDiscordUserId(
  discordUserId,
  character = {},
  options = {},
) {
  const player = await ensurePlayerByDiscordUserId(discordUserId, options);
  if (!player) {
    return null;
  }

  try {
    return await createCharacterForPlayer(player.id, character, options);
  } catch (error) {
    if (
      error instanceof Error &&
      /already exists for this player/i.test(error.message)
    ) {
      return null;
    }

    throw error;
  }
}

async function startMeditationForDiscordUserId(discordUserId, options = {}) {
  const profile =
    options.profile ??
    (await refreshCultivationProfile({ discordUserId }, options));
  if (!profile) {
    return null;
  }

  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(profile, {}, {
      meditationStartedAt: new Date().toISOString(),
    }),
    options,
  );

  return mergeCultivationProfile(profile, updatedCultivation);
}

async function stopMeditationForDiscordUserId(discordUserId, options = {}) {
  const profile =
    options.profile ??
    (await refreshCultivationProfile({ discordUserId }, options));
  if (!profile) {
    return null;
  }

  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(profile, {}, {
      meditationStartedAt: null,
    }),
    options,
  );

  return mergeCultivationProfile(profile, updatedCultivation);
}

async function setCultivationEarnRateMultiplierForDiscordUserId(
  discordUserId,
  earnRateMultiplier,
  options = {},
) {
  const profile = await refreshCultivationProfile({ discordUserId }, options);
  if (!profile) {
    return null;
  }

  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(profile, {}, {
      earnRateMultiplier: normalizeCultivationEarnRateMultiplier(
        earnRateMultiplier,
        1,
      ),
    }),
    options,
  );

  return mergeCultivationProfile(profile, updatedCultivation);
}

async function clearCultivationEarnRateMultiplierForDiscordUserId(
  discordUserId,
  options = {},
) {
  return await setCultivationEarnRateMultiplierForDiscordUserId(
    discordUserId,
    1,
    options,
  );
}

async function updateCultivationLoadoutForDiscordUserId(
  discordUserId,
  updater,
  options = {},
) {
  const profile = await refreshCultivationProfile({ discordUserId }, options);
  if (!profile || typeof updater !== 'function') {
    return null;
  }

  const nextLoadout = updater(profile.cultivation ?? {});
  if (!nextLoadout) {
    return null;
  }
  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(profile, {}, nextLoadout),
    options,
  );

  return mergeCultivationProfile(profile, updatedCultivation);
}

async function equipCultivationTechniquesForDiscordUserId(
  discordUserId,
  techniqueIds = [],
  options = {},
) {
  return await updateCultivationLoadoutForDiscordUserId(
    discordUserId,
    (cultivation) => ({
      breakthroughPreparationState: cultivation.breakthroughPreparationState ?? {},
      techniqueSlots: normalizeTechniqueLoadout(techniqueIds),
      pillCounters: cultivation.pillCounters ?? {},
      pillBuffs: cultivation.pillBuffs ?? [],
    }),
    options,
  );
}

async function prepareCultivationBreakthroughForDiscordUserId(
  discordUserId,
  actionIds = [],
  options = {},
) {
  return await updateCultivationLoadoutForDiscordUserId(
    discordUserId,
    (cultivation) => {
      const selectedActions = Array.isArray(actionIds)
        ? actionIds.slice(0, 3)
        : [actionIds].filter(Boolean);
      return {
        breakthroughPreparationState: normalizeActionState({
          selectedActions,
          stability: selectedActions.includes('stabilize-foundation') ? 1 : 0,
          condensation: selectedActions.includes('condense-qi') ? 1 : 0,
          circulation: selectedActions.includes('circulate-meridians') ? 1 : 0,
          lastPreparedAt: new Date().toISOString(),
        }),
        techniqueSlots: cultivation.techniqueSlots ?? [],
        pillCounters: cultivation.pillCounters ?? {},
        pillBuffs: cultivation.pillBuffs ?? [],
      };
    },
    options,
  );
}

async function grantCultivationPillForDiscordUserId(
  discordUserId,
  pillId,
  quantity = 1,
  options = {},
) {
  return await updateCultivationLoadoutForDiscordUserId(
    discordUserId,
    (cultivation) => {
      if (!getPillDefinition(pillId)) {
        return cultivation;
      }
      const pillCounters = {
        ...(cultivation.pillCounters ?? {}),
      };
      const normalizedQuantity = Math.max(1, Math.trunc(Number(quantity) || 0));
      pillCounters[pillId] = (Number(pillCounters[pillId]) || 0) + normalizedQuantity;
      return {
        breakthroughPreparationState:
          cultivation.breakthroughPreparationState ?? {},
        techniqueSlots: cultivation.techniqueSlots ?? [],
        pillCounters,
        pillBuffs: cultivation.pillBuffs ?? [],
      };
    },
    options,
  );
}

async function consumeCultivationPillForDiscordUserId(
  discordUserId,
  pillId,
  options = {},
) {
  return await updateCultivationLoadoutForDiscordUserId(
    discordUserId,
    (cultivation) => {
      const pillDefinition = getPillDefinition(pillId);
      if (!pillDefinition) {
        return null;
      }
      const pillCounters = {
        ...(cultivation.pillCounters ?? {}),
      };
      const currentCount = Math.max(0, Number(pillCounters[pillId]) || 0);
      if (currentCount <= 0) {
        return null;
      }

      pillCounters[pillId] = currentCount - 1;
      const grantedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const pillBuffs = [
        ...(cultivation.pillBuffs ?? []),
        {
          id: pillId,
          grantedAt,
          expiresAt,
          effects: {
            cultivationBaseGain:
              Math.max(
                0,
                Math.floor(
                  (pillDefinition?.effects?.cultivationBaseGain ?? 0) / 4,
                ),
              ),
            breakthroughChanceBonus:
              pillDefinition?.effects?.breakthroughChanceBonus ?? 0.03,
            spiritEfficiencyBonus:
              pillDefinition?.effects?.spiritEfficiencyBonus ?? 0.03,
            failurePenaltyReduction:
              pillDefinition?.effects?.failurePenaltyReduction ?? 0.03,
          },
        },
      ];

      return {
        cultivationBase:
          Math.max(0, Number(cultivation.cultivationBase) || 0) +
          Math.max(0, Number(pillDefinition?.effects?.cultivationBaseGain) || 0),
        spiritEnergy:
          getCultivationSpiritEnergy(cultivation) +
          Math.max(0, Number(pillDefinition?.effects?.spiritEnergyGain) || 0),
        qiCurrent:
          getCultivationSpiritEnergy(cultivation) +
          Math.max(0, Number(pillDefinition?.effects?.spiritEnergyGain) || 0),
        breakthroughPreparationState:
          cultivation.breakthroughPreparationState ?? {},
        techniqueSlots: cultivation.techniqueSlots ?? [],
        pillCounters,
        pillBuffs,
      };
    },
    options,
  );
}

function selectCultivationMinigame(options = {}) {
  if (options.minigame && MINIGAME_TYPES.includes(options.minigame)) {
    return options.minigame;
  }

  const roll = Number.isFinite(options.roll)
    ? Math.max(0, Math.min(0.9999, Number(options.roll)))
    : Math.random();
  const index = Math.floor(roll * MINIGAME_TYPES.length);
  return MINIGAME_TYPES[Math.min(MINIGAME_TYPES.length - 1, index)];
}

function calculateActiveCultivationOutcome(profile = {}, options = {}) {
  const cultivation = profile.cultivation ?? {};
  const derived = calculateDerivedCharacterStats(profile);
  const rateMultiplier = getCultivationEarnRateMultiplier(profile);
  const mode = ACTIVE_MODE_FACTORS[options.mode] ? options.mode : 'steady';
  const minigame = selectCultivationMinigame(options);
  const performance =
    options.performance ??
    (options.success === false
      ? 'poor'
      : options.success === true
        ? 'excellent'
        : 'normal');
  const performanceBonus =
    PERFORMANCE_BONUS[performance] ?? PERFORMANCE_BONUS.normal;
  const modeBand = ACTIVE_REWARD_BANDS[mode];
  const choice = options.choice === 'push' ? 'push' : 'stabilize';
  const minigameBonus =
    minigame === 'timing'
      ? mode === 'focused'
        ? 2
        : 0
      : minigame === 'memory'
        ? mode === 'steady'
          ? 2
          : 0
        : 0;
  const riskBonus =
    minigame === 'risk'
      ? choice === 'push'
        ? mode === 'aggressive'
          ? 4
          : 2
        : mode === 'aggressive'
          ? -2
          : -1
      : 0;
  const loadout = getCultivationLoadoutSummary(profile);
  const loadoutMinigameBonus = Math.max(
    0,
    Number(
      (loadout.techniqueSummary.minigameBonuses?.[minigame] ?? 0) +
        (loadout.preparationSummary.minigameBonuses?.[minigame] ?? 0),
    ) || 0,
  );
  const gainFloor = Math.max(
    1,
    Math.floor(
      (derived.effectiveSpirit + derived.effectiveComprehension) / 12,
    ),
    modeBand.min - 4,
  );
  const gainCeiling = modeBand.max + 12;
  const totalGain = applyCultivationEarnRate(
    clampInteger(
      pickRangeValue(modeBand, options.random) +
        performanceBonus +
        minigameBonus +
        riskBonus +
        Math.floor(modeBand.min * loadoutMinigameBonus * 2),
      gainFloor,
      gainCeiling,
      modeBand.min,
    ),
    rateMultiplier,
  );
  const splitGain = splitCultivationGain(
    applyLoadoutGain(
      totalGain,
      loadout.cultivationBaseMultiplier,
      loadout.pillCultivationBaseGain,
    ),
    derived,
  );
  const qiGain = Math.max(
    4,
    clampInteger(
      Math.floor(totalGain / 2 + derived.effectiveComprehension / 4),
      6,
      mode === 'aggressive' ? 18 : 16,
      6,
    ),
  );
  const enhancedQiGain = applyLoadoutGain(
    qiGain,
    loadout.spiritEfficiencyBonus,
  );

  const nextAccumulation = clampCultivationBase(
    profile,
    normalizeNumber(cultivation.cultivationBase) + splitGain.cultivationGain,
  );
  const nextStageProgress =
    normalizeNumber(cultivation.stageProgress) + splitGain.cultivationGain;

  const strainRoll = Number.isFinite(options.roll)
    ? Number(options.roll)
    : Math.random();
  const strainThreshold =
    minigame === 'risk'
      ? choice === 'push'
        ? mode === 'aggressive'
          ? 0.5
          : 0.3
        : mode === 'aggressive'
          ? 0.16
          : 0.08
      : mode === 'aggressive'
        ? 0.22
        : 0.08;
  const strained =
    strainRoll < strainThreshold &&
    (mode === 'aggressive' || choice === 'push');

  return {
    derived,
    mode,
    minigame,
    performance,
    choice,
    progressGain: splitGain.progressGain,
    cultivationBaseGain: splitGain.cultivationBaseGain,
    cultivationGain: splitGain.cultivationGain,
    qiGain: enhancedQiGain,
    stage: normalizeNumber(cultivation.stage, 0),
    stageProgress: nextStageProgress,
    cultivationBase: nextAccumulation,
    spiritEnergy: getCultivationSpiritEnergy(cultivation) + enhancedQiGain,
    qiCurrent: getCultivationSpiritEnergy(cultivation) + enhancedQiGain,
    breakthroughs: 0,
    strained,
    statusCondition: strained ? 'strained' : null,
    statusState: strained ? 'injured' : null,
  };
}

async function performActiveCultivationForDiscordUserId(
  discordUserId,
  options = {},
) {
  const refreshed = await refreshCultivationProfile({ discordUserId }, options);
  if (!refreshed) {
    return null;
  }

  if (refreshed.cultivation?.meditationStartedAt) {
    return {
      profile: refreshed,
      locked: true,
      message:
        'You are already meditating. Stop meditation before cultivating.',
    };
  }

  const outcome = calculateActiveCultivationOutcome(refreshed, options);
  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(refreshed, outcome, {
      lastProgressAt: new Date().toISOString(),
      meditationStartedAt: refreshed.cultivation.meditationStartedAt ?? null,
    }),
    options,
  );

  let updatedProfile = mergeCultivationProfile(refreshed, updatedCultivation);

  if (outcome.statusCondition || outcome.statusState) {
    const updatedStatus = await upsertCharacterStatus(
      {
        characterId: refreshed.character.id,
        hpCurrent: refreshed.status?.hpCurrent ?? 0,
        condition:
          outcome.statusCondition ?? refreshed.status?.condition ?? 'stable',
        state: outcome.statusState ?? refreshed.status?.state ?? 'idle',
        meridianState: refreshed.status?.meridianState ?? 'stable',
        dantianState: refreshed.status?.dantianState ?? 'stable',
        mentalState: refreshed.status?.mentalState ?? 'calm',
      },
      options,
    );

    updatedProfile = mergeCultivationProfile(
      updatedProfile,
      null,
      updatedStatus,
    );
  }

  return {
    profile: updatedProfile,
    outcome,
  };
}

async function attemptBreakthroughForDiscordUserId(
  discordUserId,
  options = {},
) {
  const refreshed = await refreshCultivationProfile({ discordUserId }, options);
  if (!refreshed) {
    return null;
  }

  if (refreshed.cultivation?.meditationStartedAt) {
    return {
      profile: refreshed,
      locked: true,
      message:
        'You are already meditating. Stop meditation before attempting an awakening or breakthrough.',
    };
  }

  const outcome = calculateBreakthroughOutcome(refreshed, options);
  if (!outcome.eligible) {
    return {
      profile: refreshed,
      outcome,
    };
  }

  const updatedCultivation = await upsertCharacterCultivation(
    buildPersistCultivationPayload(refreshed, outcome, {
      realmIndex: outcome.realmIndex,
      breakthroughFailures:
        outcome.breakthroughFailures ??
        refreshed.cultivation.breakthroughFailures ??
        0,
      lastProgressAt: new Date().toISOString(),
      lastBreakthroughAt: outcome.lastBreakthroughAt,
      meditationStartedAt: refreshed.cultivation.meditationStartedAt ?? null,
    }),
    options,
  );

  const merged = mergeCultivationProfile(refreshed, updatedCultivation);
  if (updatedCultivation?.realmIndex !== refreshed.cultivation?.realmIndex) {
    merged.realm =
      (await findRealmDefinitionByIndex(
        updatedCultivation.realmIndex,
        options,
      )) ?? merged.realm;
    merged.derived = calculateDerivedCharacterStats(merged);
  }

  return {
    profile: merged,
    outcome,
  };
}

async function getCultivationStatusForDiscordUserId(
  discordUserId,
  options = {},
) {
  return await refreshCultivationProfile({ discordUserId }, options);
}

module.exports = {
  ACTIVE_MODE_FACTORS,
  MINIGAME_TYPES,
  PASSIVE_TICK_MS,
  ACTIVE_REWARD_BANDS,
  attemptBreakthroughForDiscordUserId,
  calculateActiveCultivationOutcome,
  calculatePassiveProgressOutcome,
  calculateMeditationTickOutcome,
  createCultivatorForDiscordUserId,
  INSIGHT_BURST_GAIN_RANGE,
  MEDITATION_TICK_GAIN_RANGE,
  getCultivationStatusForDiscordUserId,
  mergeCultivationProfile,
  performActiveCultivationForDiscordUserId,
  equipCultivationTechniquesForDiscordUserId,
  prepareCultivationBreakthroughForDiscordUserId,
  grantCultivationPillForDiscordUserId,
  consumeCultivationPillForDiscordUserId,
  persistPassiveProgress,
  persistCultivationOutcome,
  refreshCultivationProfile,
  selectCultivationMinigame,
  clearMeditationSession,
  registerMeditationSession,
  startMeditationForDiscordUserId,
  stopMeditationForDiscordUserId,
  clearCultivationEarnRateMultiplierForDiscordUserId,
  setCultivationEarnRateMultiplierForDiscordUserId,
  stopActiveMeditationSession,
  getCultivationEarnRateMultiplier,
  normalizeCultivationEarnRateMultiplier,
};
