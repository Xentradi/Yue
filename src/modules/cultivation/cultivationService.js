const { withTransaction } = require('../../storage/postgres');
const {
  upsertCharacterCultivation,
} = require('../../storage/cultivationRepository');
const {
  calculateDerivedCharacterStats,
  normalizeNumber,
} = require('./derivedStatsService');
const {
  buildProfileForPlayerId,
  getFullCharacterProfile,
} = require('./profileService');
const {
  getCultivationRequirement,
  isMortalCultivator,
} = require('./requirements');
const {
  summarizeActivePillEffects,
  summarizePreparationEffects,
  summarizeTechniqueEffects,
} = require('./loadoutCatalog');

const FINAL_REALM_INDEX = 9;
const BREAKTHROUGH_BASE_CHANCE = 0.42;
const BREAKTHROUGH_MAX_CHANCE = 0.6;
const BREAKTHROUGH_PITY_STEP = 0.045;
const BREAKTHROUGH_PITY_CAP = 0.18;
const BREAKTHROUGH_RESOURCE_COST_BASE = 12;
const BREAKTHROUGH_RESOURCE_COST_GROWTH = 1.18;
const CULTIVATION_EARN_RATE_MULTIPLIERS = new Set([1, 2, 3, 6, 12]);

function getConditionMultiplier(profile = {}) {
  const condition = profile.status?.condition ?? 'stable';
  const state = profile.status?.state ?? 'idle';
  const meridianState = profile.status?.meridianState ?? 'stable';
  const dantianState = profile.status?.dantianState ?? 'stable';
  const mentalState = profile.status?.mentalState ?? 'calm';

  let multiplier = 1;

  if (condition === 'injured') {
    multiplier *= 0.75;
  } else if (condition === 'recovering') {
    multiplier *= 0.85;
  } else if (condition === 'crippled') {
    multiplier *= 0.5;
  } else if (condition === 'strained') {
    multiplier *= 0.9;
  }

  if (state === 'injured') {
    multiplier *= 0.75;
  } else if (state === 'recovering') {
    multiplier *= 0.85;
  } else if (state === 'breakthrough') {
    multiplier *= 1.15;
  }

  if (meridianState === 'strained' || dantianState === 'strained') {
    multiplier *= 0.9;
  }
  if (meridianState === 'damaged' || dantianState === 'damaged') {
    multiplier *= 0.7;
  }
  if (meridianState === 'blocked' || dantianState === 'cracked') {
    multiplier *= 0.5;
  }

  if (mentalState === 'focused') {
    multiplier *= 1.1;
  } else if (mentalState === 'shaken') {
    multiplier *= 0.85;
  } else if (mentalState === 'unstable') {
    multiplier *= 0.65;
  }

  return Math.max(0.25, multiplier);
}

function getCultivationEarnRateMultiplier(profile = {}) {
  const parsed = Math.trunc(
    normalizeNumber(profile.cultivation?.earnRateMultiplier, 1),
  );
  return CULTIVATION_EARN_RATE_MULTIPLIERS.has(parsed) ? parsed : 1;
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
  };
}

function calculateBreakthroughSpiritCost(profile = {}) {
  const cultivation = profile.cultivation ?? {};
  const loadout = getCultivationLoadoutSummary(profile);
  const realmIndex = isMortalCultivator(profile)
    ? 0
    : Math.max(
        1,
        normalizeNumber(profile.realm?.realmIndex ?? cultivation.realmIndex, 1),
      );
  const stage = isMortalCultivator(profile)
    ? 1
    : Math.max(1, normalizeNumber(cultivation.stage, 1));
  const realmCost =
    BREAKTHROUGH_RESOURCE_COST_BASE *
    Math.pow(BREAKTHROUGH_RESOURCE_COST_GROWTH, Math.max(0, realmIndex - 1));
  const efficiencyReduction = Math.min(0.35, loadout.spiritEfficiencyBonus);

  return Math.max(
    8,
    Math.floor((realmCost + Math.max(0, stage - 1)) * (1 - efficiencyReduction)),
  );
}

function isBreakthroughEligible(profile = {}) {
  const cultivation = profile.cultivation ?? {};
  const realm = profile.realm ?? {};
  const stage = Math.max(1, normalizeNumber(cultivation.stage, 1));
  const stageMax = normalizeNumber(realm.stageMax, 9);
  const required = getCultivationRequirement(profile);
  const currentCultivation = normalizeNumber(cultivation.cultivationBase);
  const currentSpiritEnergy = getCultivationSpiritEnergy(cultivation);
  const spiritCost = calculateBreakthroughSpiritCost(profile);

  if (currentCultivation < required || currentSpiritEnergy < spiritCost) {
    return false;
  }

  if (
    normalizeNumber(cultivation.realmIndex, 0) >= FINAL_REALM_INDEX &&
    stage >= stageMax
  ) {
    return false;
  }

  return true;
}

function calculateBreakthroughChance(profile = {}) {
  const derived = calculateDerivedCharacterStats(profile);
  const cultivation = profile.cultivation ?? {};
  const talent = profile.talent ?? {};
  const stage = Math.max(1, normalizeNumber(cultivation.stage, 1));
  const required = getCultivationRequirement(profile);
  const currentCultivation = Math.min(
    normalizeNumber(cultivation.cultivationBase),
    Math.floor(required * 1.8),
  );
  const currentSpiritEnergy = getCultivationSpiritEnergy(cultivation);
  const readiness = required > 0 ? currentCultivation / required : 0;
  const realmIndex = normalizeNumber(
    profile.realm?.realmIndex ?? cultivation.realmIndex,
    0,
  );
  const realmPenalty = isMortalCultivator(profile)
    ? 0.03
    : Math.max(0, realmIndex - 1) * 0.035;
  const stagePenalty = Math.max(0, stage - 1) * 0.012;
  const readinessBonus = Math.min(
    0.12,
    Math.max(0, (readiness - 1) * 0.18 + 0.05),
  );
  const attributeBonus = Math.min(
    0.14,
    derived.effectiveAttributeAverage / 90 +
      normalizeNumber(talent.rootQuality) / 220 +
      normalizeNumber(cultivation.qiQuality) / 240 +
      normalizeNumber(cultivation.foundationQuality) / 280,
  );
  const spiritBufferBonus = Math.min(0.06, currentSpiritEnergy / 250);
  const loadout = getCultivationLoadoutSummary(profile);
  const pityBonus = Math.min(
    BREAKTHROUGH_PITY_CAP,
    normalizeNumber(cultivation.breakthroughFailures) * BREAKTHROUGH_PITY_STEP,
  );

  const chance =
    BREAKTHROUGH_BASE_CHANCE +
    attributeBonus +
    spiritBufferBonus +
    readinessBonus -
    realmPenalty -
    stagePenalty +
    pityBonus +
    loadout.breakthroughChanceBonus;

  return Math.max(0.08, Math.min(BREAKTHROUGH_MAX_CHANCE, chance));
}

function resolveRandomRoll(options = {}) {
  if (Number.isFinite(options.roll)) {
    return Math.max(0, Math.min(1, Number(options.roll)));
  }

  if (typeof options.random === 'function') {
    const generated = Number(options.random());
    if (Number.isFinite(generated)) {
      return Math.max(0, Math.min(1, generated));
    }
  }

  return Math.random();
}

function calculateCultivationActionOutcome(profile = {}) {
  const derived = calculateDerivedCharacterStats(profile);
  const cultivation = profile.cultivation ?? {};
  const talent = profile.talent ?? {};
  const status = profile.status ?? {};
  const background = profile.background ?? {};
  const multiplier = getConditionMultiplier(profile);
  const earnRateMultiplier = getCultivationEarnRateMultiplier(profile);

  const talentRootQuality = normalizeNumber(talent.rootQuality);
  const qiQuality = normalizeNumber(cultivation.qiQuality);
  const foundationQuality = normalizeNumber(cultivation.foundationQuality);
  const currentCultivation = normalizeNumber(cultivation.cultivationBase);
  const cultivationCap = Math.floor(getCultivationRequirement(profile) * 1.8);
  const loadout = getCultivationLoadoutSummary(profile);

  const progressGain =
    Math.max(
      1,
      Math.floor(
        ((derived.effectiveAttributeTotal +
          talentRootQuality +
          qiQuality +
          normalizeNumber(background.spiritMod)) /
          6) *
          multiplier,
      ),
    ) * earnRateMultiplier;
  const cultivationBaseGain =
    Math.max(
      1,
      Math.floor(
        ((derived.effectiveAttributeAverage + foundationQuality + qiQuality) /
          2) *
          multiplier,
      ),
    ) * earnRateMultiplier;
  const qiGain =
    Math.max(
      1,
      Math.floor(
        ((derived.effectiveSpirit +
          derived.effectiveComprehension +
          talentRootQuality) /
          3) *
          multiplier,
      ),
    ) * earnRateMultiplier;
  const enhancedCultivationBaseGain = Math.max(
    1,
    Math.floor(
      cultivationBaseGain * (1 + loadout.cultivationBaseMultiplier),
    ),
  );
  const enhancedQiGain = Math.max(
    1,
    Math.floor(qiGain * (1 + loadout.spiritEfficiencyBonus)),
  );

  const stage = normalizeNumber(cultivation.stage, 0);
  const stageProgress =
    normalizeNumber(cultivation.stageProgress) + progressGain;
  const cultivationBase = Math.min(
    cultivationCap,
    Math.max(0, currentCultivation + enhancedCultivationBaseGain + progressGain),
  );
  const qiCurrent = getCultivationSpiritEnergy(cultivation) + enhancedQiGain;

  return {
    derived,
    multiplier,
    progressGain,
    cultivationBaseGain: enhancedCultivationBaseGain,
    qiGain: enhancedQiGain,
    breakthroughs: 0,
    stage,
    stageProgress,
    cultivationBase,
    qiCurrent,
    spiritEnergy: qiCurrent,
    lastBreakthroughAt: cultivation.lastBreakthroughAt ?? null,
    statusState: status.state ?? null,
  };
}

function calculateBreakthroughOutcome(profile = {}, options = {}) {
  const derived = calculateDerivedCharacterStats(profile);
  const cultivation = profile.cultivation ?? {};
  const realm = profile.realm ?? {};
  const mortal = isMortalCultivator(profile);
  const actionLabel = mortal ? 'awakening' : 'breakthrough';
  const actionArticle = mortal ? 'an awakening' : 'a breakthrough';
  const stage = mortal ? 1 : Math.max(1, normalizeNumber(cultivation.stage, 1));
  const realmIndex = mortal
    ? null
    : Math.max(1, normalizeNumber(cultivation.realmIndex, 1));
  const stageMax = normalizeNumber(realm.stageMax, 9);
  const required = getCultivationRequirement(profile);
  const currentCultivation = Math.min(
    normalizeNumber(cultivation.cultivationBase),
    Math.floor(required * 1.8),
  );
  const currentSpiritEnergy = getCultivationSpiritEnergy(cultivation);
  const loadout = getCultivationLoadoutSummary(profile);
  const spiritCost = calculateBreakthroughSpiritCost(profile);
  const currentFailures = normalizeNumber(cultivation.breakthroughFailures);
  const eligible = isBreakthroughEligible(profile);
  const chance = calculateBreakthroughChance(profile);
  const roll = resolveRandomRoll(options);

  if (!eligible) {
    return {
      eligible: false,
      success: false,
      chance,
      roll,
      stage,
      stageProgress: normalizeNumber(cultivation.stageProgress),
      cultivationBase: currentCultivation,
      qiCurrent: currentSpiritEnergy,
      spiritEnergy: currentSpiritEnergy,
      realmIndex,
      spiritCost,
      breakthroughFailures: currentFailures,
      message:
        currentCultivation < required && currentSpiritEnergy < spiritCost
          ? `Not enough Cultivation Base or Spirit Energy to attempt ${actionArticle}.`
          : currentCultivation < required
            ? `Not enough Cultivation Base to attempt ${actionArticle}.`
            : `Not enough Spirit Energy to attempt ${actionArticle}.`,
      derived,
    };
  }

  const success = roll <= chance;
  const remainingSpiritEnergy = Math.max(0, currentSpiritEnergy - spiritCost);
  const setbackReduction = Math.min(0.4, loadout.failurePenaltyReduction);
  const setback = Math.max(
    12,
    Math.floor(
      required * (0.08 + currentFailures * 0.03) * (1 - setbackReduction),
    ),
  );

  if (success) {
    const remainingCultivation = Math.max(0, currentCultivation - required);
    const nextRealmIndex =
      mortal || stage >= stageMax
        ? mortal
          ? 1
          : Math.min(FINAL_REALM_INDEX, realmIndex + 1)
        : realmIndex;
    const nextStage = mortal ? 1 : stage >= stageMax ? 1 : stage + 1;
    const nextRealm =
      nextRealmIndex &&
      nextRealmIndex >= 1 &&
      nextRealmIndex <= FINAL_REALM_INDEX
        ? nextRealmIndex
        : null;

    return {
      eligible: true,
      success: true,
      chance,
      roll,
      stage: nextStage,
      stageProgress: remainingCultivation,
      cultivationBase: remainingCultivation,
      qiCurrent: remainingSpiritEnergy,
      spiritEnergy: remainingSpiritEnergy,
      realmIndex: nextRealm,
      breakthroughFailures: 0,
      lastBreakthroughAt: new Date().toISOString(),
      setback: 0,
      derived,
      message: mortal
        ? 'Awakening succeeds. Your mortal senses open.'
        : nextRealm !== realmIndex
          ? 'Breakthrough succeeds. Your realm advances.'
          : 'Breakthrough succeeds. Your current stage advances.',
    };
  }

  return {
    eligible: true,
    success: false,
    chance,
    roll,
    stage,
    stageProgress: Math.max(0, currentCultivation - setback),
    cultivationBase: Math.max(0, currentCultivation - setback),
    qiCurrent: remainingSpiritEnergy,
    spiritEnergy: remainingSpiritEnergy,
    realmIndex,
    breakthroughFailures: currentFailures + 1,
    lastBreakthroughAt: cultivation.lastBreakthroughAt ?? null,
    setback,
    derived,
    spiritCost,
    message:
      `${actionLabel === 'awakening' ? 'Awakening' : 'Breakthrough'} fails. ` +
      `Spirit Energy is spent and Cultivation Base drops by ${setback}.`,
  };
}

async function performCultivationAction(input, options = {}) {
  const runAction = async (client) => {
    const profile = await getFullCharacterProfile(input, { client });
    if (!profile?.player || !profile?.cultivation || !profile?.status) {
      return null;
    }

    const outcome = calculateCultivationActionOutcome(profile);
    const updatedCultivation = await upsertCharacterCultivation(
      {
        characterId: profile.character.id,
        realmIndex: profile.cultivation.realmIndex ?? null,
        stage: outcome.stage,
        stageProgress: outcome.stageProgress,
        cultivationBase: outcome.cultivationBase,
        spiritEnergy: outcome.spiritEnergy ?? outcome.qiCurrent,
        qiCurrent: outcome.qiCurrent,
        earnRateMultiplier: profile.cultivation.earnRateMultiplier ?? 1,
        qiQuality: profile.cultivation.qiQuality,
        foundationQuality: profile.cultivation.foundationQuality,
        breakthroughFailures: profile.cultivation.breakthroughFailures ?? 0,
        lastBreakthroughAt: outcome.lastBreakthroughAt,
        breakthroughPreparationState:
          profile.cultivation.breakthroughPreparationState ?? {},
        techniqueSlots: profile.cultivation.techniqueSlots ?? [],
        pillCounters: profile.cultivation.pillCounters ?? {},
        pillBuffs: profile.cultivation.pillBuffs ?? [],
      },
      { client },
    );

    if (!updatedCultivation) {
      return null;
    }

    const refreshedProfile = await buildProfileForPlayerId(profile.player.id, {
      client,
    });
    return {
      profile: refreshedProfile,
      outcome,
    };
  };

  if (options.client) {
    return await runAction(options.client);
  }

  return await withTransaction(runAction);
}

async function performBreakthroughAttempt(input, options = {}) {
  const runAction = async (client) => {
    const profile = await getFullCharacterProfile(input, { client });
    if (!profile?.player || !profile?.cultivation || !profile?.status) {
      return null;
    }

    const outcome = calculateBreakthroughOutcome(profile, options);
    if (!outcome.eligible) {
      return {
        profile,
        outcome,
      };
    }

    const updatedCultivation = await upsertCharacterCultivation(
      {
        characterId: profile.character.id,
        realmIndex: outcome.realmIndex,
        stage: outcome.stage,
        stageProgress: outcome.stageProgress,
        cultivationBase: outcome.cultivationBase,
        spiritEnergy: outcome.spiritEnergy ?? outcome.qiCurrent,
        qiCurrent: outcome.qiCurrent,
        earnRateMultiplier: profile.cultivation.earnRateMultiplier ?? 1,
        qiQuality: profile.cultivation.qiQuality,
        foundationQuality: profile.cultivation.foundationQuality,
        breakthroughFailures: outcome.breakthroughFailures ?? 0,
        lastBreakthroughAt: outcome.lastBreakthroughAt,
        breakthroughPreparationState:
          profile.cultivation.breakthroughPreparationState ?? {},
        techniqueSlots: profile.cultivation.techniqueSlots ?? [],
        pillCounters: profile.cultivation.pillCounters ?? {},
        pillBuffs: profile.cultivation.pillBuffs ?? [],
      },
      { client },
    );

    if (!updatedCultivation) {
      return null;
    }

    const refreshedProfile = await buildProfileForPlayerId(profile.player.id, {
      client,
    });
    return {
      profile: refreshedProfile,
      outcome,
    };
  };

  if (options.client) {
    return await runAction(options.client);
  }

  return await withTransaction(runAction);
}

module.exports = {
  FINAL_REALM_INDEX,
  calculateBreakthroughChance,
  calculateBreakthroughOutcome,
  calculateCultivationActionOutcome,
  getConditionMultiplier,
  isBreakthroughEligible,
  performCultivationAction,
  performBreakthroughAttempt,
  calculateBreakthroughSpiritCost,
};
