const TECHNIQUE_LIMIT = 2;

const TECHNIQUE_DEFINITIONS = [
  {
    id: 'ember-breath-manual',
    name: 'Ember Breath Manual',
    description:
      'A steady starter method that improves base gains without demanding sharp execution.',
    bonuses: {
      cultivationBaseMultiplier: 0.08,
      breakthroughChanceBonus: 0.03,
      spiritEfficiencyBonus: 0.05,
      minigameBonuses: {
        steady: 0.03,
      },
    },
  },
  {
    id: 'jade-meridian-circulation',
    name: 'Jade Meridian Circulation',
    description:
      'A precise circulation method that rewards focus and careful timing.',
    bonuses: {
      cultivationBaseMultiplier: 0.1,
      breakthroughChanceBonus: 0.04,
      spiritEfficiencyBonus: 0.08,
      minigameBonuses: {
        focused: 0.04,
        timing: 0.03,
      },
    },
  },
  {
    id: 'void-stillness-method',
    name: 'Void Stillness Method',
    description:
      'A high-pressure method that suits aggressive cultivation and risky breakthroughs.',
    bonuses: {
      cultivationBaseMultiplier: 0.06,
      breakthroughChanceBonus: 0.05,
      spiritEfficiencyBonus: 0.04,
      minigameBonuses: {
        aggressive: 0.05,
        risk: 0.05,
      },
    },
  },
];

const PILL_DEFINITIONS = [
  {
    id: 'awakening-draught',
    name: 'Awakening Draught',
    description:
      'A beginner pill that grants an immediate surge of Cultivation Base and a little breakthrough support.',
    effects: {
      cultivationBaseGain: 48,
      breakthroughChanceBonus: 0.03,
      spiritEnergyGain: 8,
      preparationBoost: 0.03,
    },
  },
  {
    id: 'meridian-clarity-pill',
    name: 'Meridian Clarity Pill',
    description:
      'A refining pill that smooths the flow of spiritual force and helps a cultivator settle their foundation.',
    effects: {
      cultivationBaseGain: 28,
      breakthroughChanceBonus: 0.04,
      spiritEfficiencyBonus: 0.06,
      preparationBoost: 0.05,
    },
  },
  {
    id: 'solidifying-elixir',
    name: 'Solidifying Elixir',
    description:
      'A denser pill used to stabilize the path before a serious attempt.',
    effects: {
      cultivationBaseGain: 22,
      breakthroughChanceBonus: 0.05,
      failurePenaltyReduction: 0.06,
      spiritEnergyGain: 4,
    },
  },
];

const PREPARATION_ACTIONS = [
  {
    id: 'stabilize-foundation',
    name: 'Stabilize Foundation',
    description:
      'Quiet the meridians and reduce the punishment from a failed attempt.',
    effects: {
      breakthroughChanceBonus: 0.04,
      failurePenaltyReduction: 0.08,
    },
  },
  {
    id: 'condense-qi',
    name: 'Condense Qi',
    description:
      'Compress the current flow into a denser reserve for a stronger attempt.',
    effects: {
      breakthroughChanceBonus: 0.03,
      cultivationBaseMultiplier: 0.04,
      spiritEfficiencyBonus: 0.08,
    },
  },
  {
    id: 'circulate-meridians',
    name: 'Circulate Meridians',
    description:
      'Smooth the channels so the next breakthrough is less chaotic.',
    effects: {
      breakthroughChanceBonus: 0.03,
      failurePenaltyReduction: 0.04,
      minigameBonuses: {
        timing: 0.02,
        focused: 0.02,
      },
    },
  },
];

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRecordSet(value, limit) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((entry) => normalizeString(entry)).filter(Boolean)),
  ).slice(0, limit);
}

function normalizeCountMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawCount]) => [normalizeString(key), Number(rawCount)])
      .filter(([key, count]) => key && Number.isFinite(count) && count > 0)
      .map(([key, count]) => [key, Math.trunc(count)]),
  );
}

function normalizeActionState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      selectedActions: [],
      stability: 0,
      condensation: 0,
      circulation: 0,
      lastPreparedAt: null,
    };
  }

  return {
    selectedActions: normalizeRecordSet(value.selectedActions, 3),
    stability: Math.max(0, Number(value.stability) || 0),
    condensation: Math.max(0, Number(value.condensation) || 0),
    circulation: Math.max(0, Number(value.circulation) || 0),
    lastPreparedAt:
      typeof value.lastPreparedAt === 'string' ? value.lastPreparedAt : null,
  };
}

function getTechniqueDefinition(techniqueId) {
  const normalizedTechniqueId = normalizeString(techniqueId);
  if (!normalizedTechniqueId) {
    return null;
  }

  return (
    TECHNIQUE_DEFINITIONS.find((definition) => definition.id === normalizedTechniqueId) ??
    null
  );
}

function getPillDefinition(pillId) {
  const normalizedPillId = normalizeString(pillId);
  if (!normalizedPillId) {
    return null;
  }

  return (
    PILL_DEFINITIONS.find((definition) => definition.id === normalizedPillId) ??
    null
  );
}

function getPreparationActionDefinition(actionId) {
  const normalizedActionId = normalizeString(actionId);
  if (!normalizedActionId) {
    return null;
  }

  return (
    PREPARATION_ACTIONS.find((definition) => definition.id === normalizedActionId) ??
    null
  );
}

function normalizeTechniqueLoadout(value) {
  return normalizeRecordSet(value, TECHNIQUE_LIMIT)
    .filter((id) => Boolean(getTechniqueDefinition(id)))
    .slice(0, TECHNIQUE_LIMIT);
}

function normalizePillInventory(value) {
  return normalizeCountMap(value);
}

function normalizeActivePillEffects(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const pillId = normalizeString(entry.id ?? entry.pillId);
      const definition = getPillDefinition(pillId);
      if (!definition) {
        return null;
      }

      return {
        id: pillId,
        grantedAt:
          typeof entry.grantedAt === 'string' ? entry.grantedAt : null,
        expiresAt:
          typeof entry.expiresAt === 'string' ? entry.expiresAt : null,
        effects: {
          cultivationBaseGain: Math.max(
            0,
            Number(entry.effects?.cultivationBaseGain) || 0,
          ),
          breakthroughChanceBonus: Math.max(
            0,
            Number(entry.effects?.breakthroughChanceBonus) || 0,
          ),
          spiritEfficiencyBonus: Math.max(
            0,
            Number(entry.effects?.spiritEfficiencyBonus) || 0,
          ),
          failurePenaltyReduction: Math.max(
            0,
            Number(entry.effects?.failurePenaltyReduction) || 0,
          ),
        },
      };
    })
    .filter(Boolean);
}

function resolveTechniqueLoadout(techniqueIds = []) {
  return normalizeTechniqueLoadout(techniqueIds)
    .map((id) => getTechniqueDefinition(id))
    .filter(Boolean);
}

function summarizeTechniqueEffects(techniqueIds = []) {
  return resolveTechniqueLoadout(techniqueIds).reduce(
    (summary, definition) => ({
      cultivationBaseMultiplier:
        summary.cultivationBaseMultiplier +
        Number(definition.bonuses.cultivationBaseMultiplier ?? 0),
      breakthroughChanceBonus:
        summary.breakthroughChanceBonus +
        Number(definition.bonuses.breakthroughChanceBonus ?? 0),
      spiritEfficiencyBonus:
        summary.spiritEfficiencyBonus +
        Number(definition.bonuses.spiritEfficiencyBonus ?? 0),
      minigameBonuses: mergeBonusMap(
        summary.minigameBonuses,
        definition.bonuses.minigameBonuses,
      ),
    }),
    {
      cultivationBaseMultiplier: 0,
      breakthroughChanceBonus: 0,
      spiritEfficiencyBonus: 0,
      minigameBonuses: {},
    },
  );
}

function summarizePreparationEffects(preparationState = {}) {
  const actionIds = normalizeRecordSet(preparationState.selectedActions, 3);
  return actionIds
    .map((actionId) => getPreparationActionDefinition(actionId))
    .filter(Boolean)
    .reduce(
      (summary, definition) => ({
        cultivationBaseMultiplier:
          summary.cultivationBaseMultiplier +
          Number(definition.effects.cultivationBaseMultiplier ?? 0),
        breakthroughChanceBonus:
          summary.breakthroughChanceBonus +
          Number(definition.effects.breakthroughChanceBonus ?? 0),
        spiritEfficiencyBonus:
          summary.spiritEfficiencyBonus +
          Number(definition.effects.spiritEfficiencyBonus ?? 0),
        failurePenaltyReduction:
          summary.failurePenaltyReduction +
          Number(definition.effects.failurePenaltyReduction ?? 0),
        minigameBonuses: mergeBonusMap(
          summary.minigameBonuses,
          definition.effects.minigameBonuses,
        ),
      }),
      {
        cultivationBaseMultiplier: 0,
        breakthroughChanceBonus: 0,
        spiritEfficiencyBonus: 0,
        failurePenaltyReduction: 0,
        minigameBonuses: {},
      },
    );
}

function summarizeActivePillEffects(activePillEffects = [], now = new Date()) {
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  return normalizeActivePillEffects(activePillEffects)
    .filter((effect) => {
      if (!effect.expiresAt) {
        return true;
      }

      const expiresAt = new Date(effect.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt > currentTime;
    })
    .reduce(
      (summary, effect) => ({
        cultivationBaseGain:
          summary.cultivationBaseGain +
          Number(effect.effects.cultivationBaseGain ?? 0),
        breakthroughChanceBonus:
          summary.breakthroughChanceBonus +
          Number(effect.effects.breakthroughChanceBonus ?? 0),
        spiritEfficiencyBonus:
          summary.spiritEfficiencyBonus +
          Number(effect.effects.spiritEfficiencyBonus ?? 0),
        failurePenaltyReduction:
          summary.failurePenaltyReduction +
          Number(effect.effects.failurePenaltyReduction ?? 0),
      }),
      {
        cultivationBaseGain: 0,
        breakthroughChanceBonus: 0,
        spiritEfficiencyBonus: 0,
        failurePenaltyReduction: 0,
      },
    );
}

function mergeBonusMap(left = {}, right = {}) {
  const merged = { ...left };

  for (const [key, value] of Object.entries(right ?? {})) {
    merged[key] = (merged[key] ?? 0) + Number(value ?? 0);
  }

  return merged;
}

module.exports = {
  TECHNIQUE_LIMIT,
  TECHNIQUE_DEFINITIONS,
  PILL_DEFINITIONS,
  PREPARATION_ACTIONS,
  getPillDefinition,
  getPreparationActionDefinition,
  getTechniqueDefinition,
  normalizeActivePillEffects,
  normalizeActionState,
  normalizePillInventory,
  normalizeTechniqueLoadout,
  resolveTechniqueLoadout,
  summarizeActivePillEffects,
  summarizePreparationEffects,
  summarizeTechniqueEffects,
};
