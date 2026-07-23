function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sumCharacterAttributes(attributes = {}) {
  return (
    normalizeNumber(attributes.physique) +
    normalizeNumber(attributes.comprehension) +
    normalizeNumber(attributes.spirit) +
    normalizeNumber(attributes.fortune)
  );
}

function applyBackgroundModifiers(attributes = {}, background = {}) {
  const physique = Math.max(
    0,
    normalizeNumber(attributes.physique) +
      normalizeNumber(background.physiqueMod),
  );
  const comprehension = Math.max(
    0,
    normalizeNumber(attributes.comprehension) +
      normalizeNumber(background.comprehensionMod),
  );
  const spirit = Math.max(
    0,
    normalizeNumber(attributes.spirit) + normalizeNumber(background.spiritMod),
  );
  const fortune = Math.max(
    0,
    normalizeNumber(attributes.fortune) +
      normalizeNumber(background.fortuneMod),
  );

  return {
    physique,
    comprehension,
    spirit,
    fortune,
  };
}

function calculateDerivedCharacterStats(profile = {}) {
  const attributes = profile.attributes ?? {};
  const cultivation = profile.cultivation ?? {};
  const realm = profile.realm ?? null;
  const status = profile.status ?? {};
  const background = profile.background ?? {};

  const attributeTotal = sumCharacterAttributes(attributes);
  const attributeAverage = attributeTotal / 4;
  const effectiveAttributes = applyBackgroundModifiers(attributes, background);
  const effectiveAttributeTotal = sumCharacterAttributes(effectiveAttributes);
  const effectiveAttributeAverage = effectiveAttributeTotal / 4;
  const stage = normalizeNumber(cultivation.stage);
  const stageMax = normalizeNumber(realm?.stageMax);
  const stageProgress = normalizeNumber(cultivation.stageProgress);
  const cultivationProgressRatio =
    stageMax > 0 ? Math.min(1, Math.max(0, stage / stageMax)) : null;
  const backgroundModifierTotal =
    normalizeNumber(background.physiqueMod) +
    normalizeNumber(background.comprehensionMod) +
    normalizeNumber(background.spiritMod) +
    normalizeNumber(background.fortuneMod);

  return {
    realmIndex: realm?.realmIndex ?? null,
    realmName: realm?.name ?? 'Mortal',
    realmStageMax: stageMax > 0 ? stageMax : null,
    realmHasTribulation: Boolean(realm?.hasTribulation),
    isMortal: !realm?.realmIndex,
    backgroundKey: background.key ?? null,
    backgroundName: background.name ?? null,
    backgroundModifierTotal,
    attributeTotal,
    attributeAverage,
    effectivePhysique: effectiveAttributes.physique,
    effectiveComprehension: effectiveAttributes.comprehension,
    effectiveSpirit: effectiveAttributes.spirit,
    effectiveFortune: effectiveAttributes.fortune,
    effectiveAttributeTotal,
    effectiveAttributeAverage,
    stage: stage > 0 ? stage : 0,
    stageProgress,
    isAtRealmCap: stageMax > 0 ? stage >= stageMax : false,
    cultivationProgressRatio,
    condition: status.condition ?? null,
    state: status.state ?? null,
    meridianState: status.meridianState ?? null,
    dantianState: status.dantianState ?? null,
    mentalState: status.mentalState ?? null,
  };
}

module.exports = {
  applyBackgroundModifiers,
  calculateDerivedCharacterStats,
  normalizeNumber,
  sumCharacterAttributes,
};
