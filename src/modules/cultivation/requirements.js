const CULTIVATION_REQUIREMENT_BASE = 200;
const CULTIVATION_REQUIREMENT_GROWTH = 1.35;
const CULTIVATION_REQUIREMENT_CURVE = 0.06;
const CULTIVATION_REQUIREMENT_POWER = 1.55;
const MORTAL_AWAKENING_REQUIREMENT = 120;

function toStageNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
}

function toRealmIndex(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
}

function getCultivationRequirementForStage(realmIndex = 1, stage = 0) {
  const normalizedRealmIndex = toRealmIndex(realmIndex);
  const normalizedStage = toStageNumber(stage);
  const realmBase =
    CULTIVATION_REQUIREMENT_BASE *
    Math.pow(CULTIVATION_REQUIREMENT_GROWTH, normalizedRealmIndex - 1);

  // Stage is one-based in player-facing progression.
  return Math.floor(
    realmBase *
      (1 +
        CULTIVATION_REQUIREMENT_CURVE *
          Math.pow(normalizedStage - 1, CULTIVATION_REQUIREMENT_POWER)),
  );
}

function getCultivationRequirement(profile = {}) {
  const realmIndex = Number(
    profile?.realm?.realmIndex ?? profile?.cultivation?.realmIndex,
  );

  if (!Number.isFinite(realmIndex) || realmIndex < 1) {
    return MORTAL_AWAKENING_REQUIREMENT;
  }

  return getCultivationRequirementForStage(
    realmIndex,
    profile?.cultivation?.stage ?? 1,
  );
}

function isMortalCultivator(profile = {}) {
  const realmIndex = Number(
    profile?.realm?.realmIndex ?? profile?.cultivation?.realmIndex,
  );
  return !Number.isFinite(realmIndex) || realmIndex < 1;
}

module.exports = {
  CULTIVATION_REQUIREMENT_BASE,
  CULTIVATION_REQUIREMENT_CURVE,
  CULTIVATION_REQUIREMENT_GROWTH,
  CULTIVATION_REQUIREMENT_POWER,
  MORTAL_AWAKENING_REQUIREMENT,
  getCultivationRequirement,
  getCultivationRequirementForStage,
  isMortalCultivator,
};
