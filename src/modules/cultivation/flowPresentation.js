const { createStatusEmbed } = require('../../utils/economyFeedback');
const {
  MORTAL_AWAKENING_REQUIREMENT,
  getCultivationRequirement,
  isMortalCultivator,
} = require('./requirements');

const PATH_LABELS = {
  body: 'Body',
  qi: 'Spirit',
  balanced: 'Balanced',
};

const NEXT_STEP_THRESHOLDS = {
  lowSpiritRatio: 0.45,
  prepRatio: 0.8,
};

function formatNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${Math.trunc(parsed)}` : '0';
}

function formatPathLabel(path) {
  return PATH_LABELS[path] ?? 'Balanced';
}

function formatModeLabel(mode) {
  const labels = {
    steady: 'Steady',
    focused: 'Focused',
    aggressive: 'Aggressive',
  };

  return labels[mode] ?? 'Steady';
}

function formatRealmName(profile = {}) {
  return profile?.derived?.realmName ?? profile?.realm?.name ?? 'Mortal';
}

function formatStageValue(profile = {}) {
  if (
    isMortalCultivator(profile) ||
    Number(profile?.cultivation?.stage ?? 0) < 1
  ) {
    return 'Awakening';
  }

  return formatNumber(profile?.cultivation?.stage ?? 1);
}

function formatQiAccumulationRequirement(profile = {}) {
  const current = formatNumber(profile?.cultivation?.cultivationBase);
  const required = formatNumber(getCultivationRequirement(profile));

  return `${current} / ${required}`;
}

function formatSpiritEnergy(profile = {}) {
  return formatNumber(
    profile?.cultivation?.spiritEnergy ?? profile?.cultivation?.qiCurrent,
  );
}

function getBreakthroughReadiness(profile = {}) {
  const required = getCultivationRequirement(profile);
  const currentBase = Number(profile?.cultivation?.cultivationBase ?? 0);
  const spiritEnergy = getCultivationSpiritEnergy(profile);
  const spiritCost = getBreakthroughSpiritCost(profile);

  return {
    required,
    currentBase,
    spiritEnergy,
    spiritCost,
    missingBase: Math.max(0, required - currentBase),
    missingSpirit: Math.max(0, spiritCost - spiritEnergy),
  };
}

function isBreakthroughReady(profile = {}) {
  const readiness = getBreakthroughReadiness(profile);
  return readiness.currentBase >= readiness.required &&
    readiness.spiritEnergy >= readiness.spiritCost;
}

function getCultivationSpiritEnergy(profile = {}) {
  return Number(profile?.cultivation?.spiritEnergy ?? profile?.cultivation?.qiCurrent ?? 0);
}

function getBreakthroughSpiritCost(profile = {}) {
  const realmIndex = Number(profile?.realm?.realmIndex ?? profile?.cultivation?.realmIndex);
  const stage = Number(profile?.cultivation?.stage ?? 1);
  const normalizedRealmIndex = Number.isFinite(realmIndex) && realmIndex >= 1 ? Math.trunc(realmIndex) : 1;
  const normalizedStage = Number.isFinite(stage) && stage >= 1 ? Math.trunc(stage) : 1;
  const baseCost = 12 * Math.pow(1.18, Math.max(0, normalizedRealmIndex - 1));
  return Math.max(8, Math.floor((baseCost + Math.max(0, normalizedStage - 1))));
}

function getNextStepSuggestion(profile = {}) {
  if (!profile?.cultivation || !profile?.character) {
    return null;
  }

  const cultivation = profile.cultivation;
  const readiness = getBreakthroughReadiness(profile);
  const currentBase = readiness.currentBase;
  const required = readiness.required;
  const spiritEnergy = readiness.spiritEnergy;
  const spiritCost = readiness.spiritCost;
  const preparationActions = Array.isArray(
    cultivation.breakthroughPreparationState?.selectedActions,
  )
    ? cultivation.breakthroughPreparationState.selectedActions
    : [];
  const techniqueSlots = Array.isArray(cultivation.techniqueSlots)
    ? cultivation.techniqueSlots
    : [];
  const pillCounters = cultivation.pillCounters && typeof cultivation.pillCounters === 'object'
    ? cultivation.pillCounters
    : {};
  const hasPills = Object.values(pillCounters).some((count) => Number(count) > 0);
  const hasOpenTechniqueSlot = techniqueSlots.length < 2;
  const hasNoPreparation = preparationActions.length === 0;
  const lowSpiritThreshold = Math.max(
    spiritCost + 1,
    Math.ceil(required * NEXT_STEP_THRESHOLDS.lowSpiritRatio),
  );
  const nearBreakthroughThreshold = Math.max(
    spiritCost,
    Math.floor(required * NEXT_STEP_THRESHOLDS.prepRatio),
  );

  if (isBreakthroughReady(profile)) {
    return {
      command: '/breakthrough',
      label: isMortalCultivator(profile) ? 'Awaken' : 'Break through',
      reason: isMortalCultivator(profile)
        ? 'You have enough Cultivation Base and Spirit Energy to awaken.'
        : 'You have enough Cultivation Base and Spirit Energy to break through.',
    };
  }

  if (spiritEnergy < lowSpiritThreshold) {
    return {
      command: '/meditate',
      label: 'Recover Spirit Energy',
      reason: 'Spirit Energy is low, so meditation will steady your reserves.',
    };
  }

  if (currentBase >= nearBreakthroughThreshold && hasNoPreparation) {
    return {
      command: '/cultivation',
      label: 'Prepare for breakthrough',
      reason: 'Your Cultivation Base is close, but preparation is still thin.',
    };
  }

  if (hasOpenTechniqueSlot || hasPills || hasNoPreparation) {
    return {
      command: '/cultivation',
      label: hasOpenTechniqueSlot
        ? 'Equip techniques'
        : hasPills
          ? 'Use your pills'
          : 'Set preparation',
      reason: hasOpenTechniqueSlot
        ? 'You have room for another technique.'
        : hasPills
          ? 'You have pills waiting in your inventory.'
          : 'Your breakthrough preparation is still empty.',
    };
  }

  return {
    command: '/cultivate',
    label: 'Keep cultivating',
    reason: 'Continue building Cultivation Base.',
  };
}

function createNextStepField(profile = {}) {
  const suggestion = getNextStepSuggestion(profile);
  if (!suggestion) {
    return null;
  }

  return {
    name: 'Next Step',
    value: `${suggestion.command} - ${suggestion.label}. ${suggestion.reason}`,
    inline: false,
  };
}

function formatBackgroundEffectSummary(background = {}) {
  const modifiers = [
    ['physiqueMod', 'physique'],
    ['comprehensionMod', 'comprehension'],
    ['spiritMod', 'spirit'],
    ['fortuneMod', 'fortune'],
  ].map(([key, label]) => ({
    key,
    label,
    value: Number(background[key] ?? 0),
  }));

  const positiveLabels = modifiers
    .filter((modifier) => modifier.value > 0)
    .map((modifier) => modifier.label);
  const negativeLabels = modifiers
    .filter((modifier) => modifier.value < 0)
    .map((modifier) => modifier.label);

  if (!positiveLabels.length && !negativeLabels.length) {
    return 'Balanced across all growth lanes.';
  }

  const parts = [];
  if (positiveLabels.length) {
    parts.push(`Favors ${joinWithAnd(positiveLabels)}`);
  }
  if (negativeLabels.length) {
    parts.push(`weaker ${joinWithAnd(negativeLabels)}`);
  }

  return `${parts.join('; ')}.`;
}

function createActionLockEmbed(title, description, color = '#f4a261') {
  return createStatusEmbed({
    title,
    description,
    color,
  });
}

function formatBackgroundList(backgrounds = []) {
  if (!backgrounds.length) {
    return 'Use background autocomplete to browse options.';
  }

  return backgrounds
    .map(
      (background) =>
        `${background.name}: ${formatBackgroundEffectSummary(background)}`,
    )
    .join('\n');
}

function createOnboardingEmbed(backgrounds = []) {
  return createStatusEmbed({
    title: '🌱 Begin the Mortal Path',
    description:
      'Create your mortal with `/start`. Your first goal is to build Cultivation Base and awaken into Body Refinement.',
    fields: [
      {
        name: 'Quick Start',
        value:
          '/start name:<name> background:<background> path:<body|spirit|balanced>',
        inline: false,
      },
      {
        name: 'Path Choices',
        value: [
          '`body` - safer physical growth',
          '`spirit` - stronger spirit refinement',
          '`balanced` - steady all-round growth',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'First Step',
        value: [
          `Gather ${MORTAL_AWAKENING_REQUIREMENT} Cultivation Base`,
          'Then use `/breakthrough` to awaken your spirit.',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Backgrounds',
        value: formatBackgroundList(backgrounds),
        inline: false,
      },
    ],
    color: '#7db6ff',
  });
}

function createProfileEmbed(profile) {
  const realmName = formatRealmName(profile);
  const stage = formatStageValue(profile);
  const qiAccumulation = formatQiAccumulationRequirement(profile);
  const spiritEnergy = formatSpiritEnergy(profile);
  const readiness = getBreakthroughReadiness(profile);
  const actionLabel = isMortalCultivator(profile)
    ? 'awakening'
    : 'breakthrough';
  const actionArticle = actionLabel === 'awakening' ? 'an awakening' : 'a breakthrough';
  const readyText = isBreakthroughReady(profile)
    ? isMortalCultivator(profile)
      ? 'Ready to awaken.'
      : 'Ready for breakthrough.'
    : readiness.missingBase > 0 && readiness.missingSpirit > 0
      ? `Need ${readiness.missingBase} more Cultivation Base and ${readiness.missingSpirit} more Spirit Energy to attempt ${actionArticle}.`
      : readiness.missingSpirit > 0
        ? `Need ${readiness.missingSpirit} more Spirit Energy to attempt ${actionArticle}.`
        : `Need ${readiness.missingBase} more Cultivation Base to attempt ${actionArticle}.`;
  const nextStepField = createNextStepField(profile);

  return createStatusEmbed({
    title: '🌌 Cultivation Profile',
    description: `${profile?.character?.name ?? 'Your mortal'} is in ${realmName}. ${readyText}`,
    fields: [
      { name: 'Realm', value: realmName, inline: true },
      { name: 'Stage', value: stage, inline: true },
      { name: 'Cultivation Base', value: qiAccumulation, inline: true },
      { name: 'Spirit Energy', value: spiritEnergy, inline: true },
      ...(nextStepField ? [nextStepField] : []),
    ],
    color: '#7db6ff',
  });
}

function createStartSuccessEmbed(profile) {
  const realmName = formatRealmName(profile);

  return createStatusEmbed({
    title: '⚔️ Mortal Born',
    description: `${profile?.character?.name ?? 'Your mortal'} begins on the mortal path.`,
    fields: [
      {
        name: 'Background',
        value: `${profile?.background?.name ?? 'Unknown'}\n${formatBackgroundEffectSummary(profile?.background ?? {})}`,
        inline: false,
      },
      { name: 'Realm', value: realmName, inline: true },
      {
        name: 'Stage',
        value: formatStageValue(profile),
        inline: true,
      },
      {
        name: 'Cultivation Base',
        value: formatQiAccumulationRequirement(profile),
        inline: true,
      },
      {
        name: 'Spirit Energy',
        value: formatSpiritEnergy(profile),
        inline: true,
      },
    ],
    color: '#4dd4ac',
  });
}

function createDuplicateCharacterEmbed() {
  return createStatusEmbed({
    title: '⚠️ Character Already Exists',
    description:
      'You already have a mortal. Use `/profile`, `/cultivate`, `/meditate`, or `/breakthrough`.',
    color: '#f4a261',
  });
}

function createBreakthroughResultEmbed(profile, outcome) {
  const realmName = formatRealmName(profile);
  const qiAccumulation = formatQiAccumulationRequirement(profile);
  const spiritEnergy = formatSpiritEnergy(profile);
  const readiness = getBreakthroughReadiness(profile);
  const actionLabel = isMortalCultivator(profile)
    ? 'awakening'
    : 'breakthrough';
  const actionArticle = actionLabel === 'awakening' ? 'an awakening' : 'a breakthrough';
  const readyText = isBreakthroughReady(profile)
    ? isMortalCultivator(profile)
      ? 'You can attempt an awakening.'
      : 'You can attempt a breakthrough.'
    : readiness.missingBase > 0 && readiness.missingSpirit > 0
      ? `Need ${readiness.missingBase} more Cultivation Base and ${readiness.missingSpirit} more Spirit Energy to attempt ${actionArticle}.`
      : readiness.missingSpirit > 0
        ? `Need ${readiness.missingSpirit} more Spirit Energy to attempt ${actionArticle}.`
        : `Need ${readiness.missingBase} more Cultivation Base to attempt ${actionArticle}.`;
  const title =
    outcome?.eligible === false
      ? isMortalCultivator(profile)
        ? 'Awakening Not Ready'
        : 'Breakthrough Not Ready'
      : outcome?.success
        ? isMortalCultivator(profile)
          ? 'Awakening Success'
          : 'Breakthrough Success'
        : isMortalCultivator(profile)
          ? 'Awakening Failed'
          : 'Breakthrough Failed';
  const color =
    outcome?.eligible === false
      ? '#f4a261'
      : outcome?.success
        ? '#4dd4ac'
        : '#e76f51';
  const nextStepField = createNextStepField(profile);

  return createStatusEmbed({
    title,
    description: outcome?.message ?? readyText,
    fields: [
      { name: 'Realm', value: realmName, inline: true },
      {
        name: 'Stage',
        value:
          Number(outcome?.stage ?? profile?.cultivation?.stage ?? 1) < 1
            ? 'Awakening'
            : formatNumber(outcome?.stage ?? profile?.cultivation?.stage ?? 1),
        inline: true,
      },
      { name: 'Cultivation Base', value: qiAccumulation, inline: true },
      { name: 'Spirit Energy', value: spiritEnergy, inline: true },
      {
        name: 'Spirit Energy Cost',
        value: `${formatNumber(outcome?.spiritCost ?? 0)}`,
        inline: true,
      },
      ...(nextStepField ? [nextStepField] : []),
    ],
    color,
  });
}

function createMeditationStartEmbed(profile) {
  return createStatusEmbed({
    title: '🧘 Meditation Begun',
    description: `${profile?.character?.name ?? 'Your mortal'} settles into meditation. Other gameplay actions are locked until you stop.`,
    fields: [
      {
        name: 'Cultivation Base',
        value: 'Gains Cultivation Base every 5 seconds while you meditate.',
        inline: false,
      },
      {
        name: 'Spirit Energy',
        value:
          'Meditation also gathers Spirit Energy. Insight bursts send a separate alert.',
        inline: false,
      },
    ],
    color: '#7db6ff',
  });
}

function createMeditationTickEmbed(profile, tickOutcome) {
  const title = tickOutcome.insightProc
    ? '✨ Insight Burst'
    : '🧘 Meditation Flow';
  const description = tickOutcome.insightProc
    ? `An insight burst lands. +${formatNumber(tickOutcome.cultivationGain ?? tickOutcome.progressGain)} Cultivation Base.`
    : `Meditation continues. +${formatNumber(tickOutcome.cultivationGain ?? tickOutcome.progressGain)} Cultivation Base.`;

  return createStatusEmbed({
    title,
    description,
    fields: [
      {
        name: 'Realm',
        value: profile?.derived?.realmName ?? profile?.realm?.name ?? 'Unknown',
        inline: true,
      },
      {
        name: 'Stage',
        value: formatStageValue(profile),
        inline: true,
      },
      {
        name: 'Cultivation Base',
        value: formatQiAccumulationRequirement(profile),
        inline: true,
      },
      {
        name: 'Spirit Energy',
        value: formatSpiritEnergy(profile),
        inline: true,
      },
    ],
    color: tickOutcome.insightProc ? '#4dd4ac' : '#7db6ff',
  });
}

function createMeditationEndEmbed(profile, summary) {
  return createStatusEmbed({
    title: '🛑 Meditation Ended',
    description:
      summary ??
      `${profile?.character?.name ?? 'Your cultivator'} rises from meditation.`,
    fields: [
      {
        name: 'Realm',
        value: formatRealmName(profile),
        inline: true,
      },
      {
        name: 'Stage',
        value: formatStageValue(profile),
        inline: true,
      },
      {
        name: 'Cultivation Base',
        value: formatQiAccumulationRequirement(profile),
        inline: true,
      },
      {
        name: 'Spirit Energy',
        value: formatSpiritEnergy(profile),
        inline: true,
      },
    ],
    color: '#f4a261',
  });
}

function createCultivationPromptEmbed(profile, mode, minigame, promptText) {
  return createStatusEmbed({
    title: `🌊 ${formatModeLabel(mode)} Technique`,
    description: promptText,
    fields: [
      {
        name: 'Realm',
        value: formatRealmName(profile),
        inline: true,
      },
      {
        name: 'Stage',
        value: formatStageValue(profile),
        inline: true,
      },
      {
        name: 'Cultivation Base',
        value: formatQiAccumulationRequirement(profile),
        inline: true,
      },
      {
        name: 'Spirit Energy',
        value: formatSpiritEnergy(profile),
        inline: true,
      },
    ],
    color: '#7db6ff',
  });
}

function createCultivateResultEmbed(profile, outcome, summary) {
  const gain = formatNumber(
    outcome?.cultivationGain ?? outcome?.progressGain ?? 0,
  );
  const spiritGain = formatNumber(outcome?.qiGain ?? 0);
  const lines = ['You refine your cultivation base.', `+${gain} Cultivation Base`];
  if (spiritGain !== '0') {
    lines.push(`+${spiritGain} Spirit Energy`);
  }
  const nextStepField = createNextStepField(profile);

  return createStatusEmbed({
    title: summary?.title ?? 'Cultivation Complete',
    description: lines.join('\n'),
    fields: [
      {
        name: 'Realm',
        value: formatRealmName(profile),
        inline: true,
      },
      {
        name: 'Stage',
        value: formatStageValue(profile),
        inline: true,
      },
      {
        name: 'Cultivation Base',
        value: formatQiAccumulationRequirement(profile),
        inline: true,
      },
      {
        name: 'Spirit Energy',
        value: formatSpiritEnergy(profile),
        inline: true,
      },
      ...(nextStepField ? [nextStepField] : []),
    ],
    color: outcome?.strained ? '#e76f51' : '#4dd4ac',
  });
}

function formatButtonLabel(buttonLabel, mode) {
  return `${buttonLabel} • ${formatModeLabel(mode)}`;
}

function joinWithAnd(items = []) {
  if (items.length <= 1) {
    return items[0] ?? '';
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

module.exports = {
  createBreakthroughResultEmbed,
  createActionLockEmbed,
  createCultivationPromptEmbed,
  createCultivateResultEmbed,
  createDuplicateCharacterEmbed,
  createMeditationEndEmbed,
  createMeditationStartEmbed,
  createMeditationTickEmbed,
  createOnboardingEmbed,
  createProfileEmbed,
  createStartSuccessEmbed,
  createNextStepField,
  formatBackgroundEffectSummary,
  formatBackgroundList,
  formatButtonLabel,
  formatModeLabel,
  formatPathLabel,
  getNextStepSuggestion,
};
