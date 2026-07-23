const assert = require('node:assert/strict');
const test = require('node:test');
const { mock } = require('node:test');

const {
  ensureReferenceDataSeeded,
} = require('../../src/storage/cultivationSchema');
const flowService = require('../../src/modules/cultivation/flowService');
const {
  calculateBreakthroughChance,
  calculateBreakthroughOutcome,
} = require('../../src/modules/cultivation/cultivationService');
const {
  buildCultivationChallenge,
  evaluateCultivationChallenge,
} = require('../../src/modules/cultivation/minigames');
const {
  normalizeTechniqueLoadout,
  summarizeActivePillEffects,
  summarizePreparationEffects,
  summarizeTechniqueEffects,
} = require('../../src/modules/cultivation/loadoutCatalog');
const config = require('../../src/config.json');
const {
  createBreakthroughResultEmbed,
  createCultivateResultEmbed,
  createProfileEmbed,
  getNextStepSuggestion,
} = require('../../src/modules/cultivation/flowPresentation');
const {
  getCultivationRequirementForStage,
} = require('../../src/modules/cultivation/requirements');
const cultivationRateCommand = require('../../src/commands/admin/cultivationRate');
const {
  canUseAdminCommands,
  canViewAdminCommands,
} = require('../../src/utils/adminPermissions');
const meditateCommand = require('../../src/commands/cultivation/meditate');

test.afterEach(() => {
  mock.restoreAll();
});

test('reference data seeding skips inserts when rows already exist', async () => {
  const queries = [];
  const runner = {
    async query(sql) {
      queries.push(sql);
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (
        normalized.includes('FROM realm_definitions LIMIT 1') ||
        normalized.includes('FROM background_definitions LIMIT 1')
      ) {
        return { rows: [{ exists: true }] };
      }

      return { rows: [] };
    },
  };

  await ensureReferenceDataSeeded(runner);

  assert.ok(
    queries.some((sql) =>
      sql.replace(/\s+/g, ' ').includes('FROM realm_definitions LIMIT 1'),
    ),
  );
  assert.ok(
    queries.some((sql) =>
      sql.replace(/\s+/g, ' ').includes('FROM background_definitions LIMIT 1'),
    ),
  );
  assert.ok(
    !queries.some((sql) => sql.includes('INSERT INTO realm_definitions')),
  );
  assert.ok(
    !queries.some((sql) => sql.includes('INSERT INTO background_definitions')),
  );
});

test('timing and memory prompts make the actual UI obvious', () => {
  const profile = makeProfile();

  const timingChallenge = buildCultivationChallenge(profile, 'focused', {
    minigame: 'timing',
    random: () => 0.4,
  });
  assert.match(timingChallenge.prompt, /bright center window/i);
  assert.match(timingChallenge.prompt, /Timing window:/i);
  assert.match(timingChallenge.prompt, /🟩/);

  const memoryChallenge = buildCultivationChallenge(profile, 'steady', {
    minigame: 'memory',
    memoryQuestionType: 'second',
    random: () => 0,
  });
  assert.match(memoryChallenge.prompt, /Which was second\?/i);
  assert.equal(memoryChallenge.buttons.length, 3);
  assert.notDeepEqual(
    memoryChallenge.buttons.map((button) => button.id),
    memoryChallenge.context.shownGlyphs,
  );
  assert.deepEqual(
    memoryChallenge.context.buttonOrder,
    memoryChallenge.buttons.map((button) => button.id),
  );

  const evaluation = evaluateCultivationChallenge(memoryChallenge, {
    choice: memoryChallenge.context.correctChoice,
  });
  assert.equal(evaluation.success, true);
});

test('cultivation requirement curve is smooth and shared across realms', () => {
  const bodyRequirements = Array.from({ length: 9 }, (_value, index) =>
    getCultivationRequirementForStage(1, index + 1),
  );
  const qiRequirements = Array.from({ length: 3 }, (_value, index) =>
    getCultivationRequirementForStage(2, index + 1),
  );

  assert.deepEqual(
    bodyRequirements,
    [200, 212, 235, 265, 302, 345, 392, 444, 501],
  );
  assert.deepEqual(qiRequirements, [270, 286, 317]);
});

test('mortal onboarding shows awakening instead of stage zero', () => {
  const profile = makeProfile();
  const embed = createProfileEmbed(profile);

  assert.deepEqual(
    embed.data.fields.map((field) => field.name),
    ['Realm', 'Stage', 'Cultivation Base', 'Spirit Energy', 'Next Step'],
  );
  assert.equal(embed.data.fields[1].value, 'Awakening');
  assert.match(embed.data.description, /Mortal/i);
  assert.match(embed.data.description, /Cultivation Base/i);
  assert.match(embed.data.fields.at(-1).value, /\/meditate/);
});

test('next step suggestions stay deterministic and do not conflict', () => {
  const breakthroughReady = makeProfile({
    realm: {
      id: 'realm-1',
      realmIndex: 1,
      stageMax: 9,
      name: 'Body Refinement',
    },
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: 1,
      stage: 1,
      cultivationBase: 240,
      spiritEnergy: 24,
      qiCurrent: 24,
    },
  });
  const lowSpirit = makeProfile({
    realm: {
      id: 'realm-1',
      realmIndex: 1,
      stageMax: 9,
      name: 'Body Refinement',
    },
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: 1,
      stage: 1,
      cultivationBase: 12,
      spiritEnergy: 0,
      qiCurrent: 0,
    },
  });
  const needsPrep = makeProfile({
    realm: {
      id: 'realm-1',
      realmIndex: 1,
      stageMax: 9,
      name: 'Body Refinement',
    },
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: 1,
      stage: 1,
      cultivationBase: 170,
      spiritEnergy: 100,
      qiCurrent: 100,
      breakthroughPreparationState: {
        selectedActions: [],
        stability: 0,
        condensation: 0,
        circulation: 0,
        lastPreparedAt: null,
      },
    },
  });
  const hubNeeded = makeProfile({
    realm: {
      id: 'realm-1',
      realmIndex: 1,
      stageMax: 9,
      name: 'Body Refinement',
    },
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: 1,
      stage: 1,
      cultivationBase: 20,
      spiritEnergy: 100,
      qiCurrent: 100,
      techniqueSlots: ['ember-breath-manual'],
      pillCounters: { 'awakening-draught': 1 },
      breakthroughPreparationState: {
        selectedActions: [],
        stability: 0,
        condensation: 0,
        circulation: 0,
        lastPreparedAt: null,
      },
    },
  });

  assert.equal(getNextStepSuggestion(breakthroughReady).command, '/breakthrough');
  assert.equal(getNextStepSuggestion(lowSpirit).command, '/meditate');
  assert.equal(getNextStepSuggestion(needsPrep).command, '/cultivation');
  assert.equal(getNextStepSuggestion(hubNeeded).command, '/cultivation');
  assert.match(getNextStepSuggestion(hubNeeded).reason, /technique|pills|preparation/i);
});

test('reward bands stay ordered and active cultivation beats two meditation ticks', () => {
  const profile = makeProfile();

  const steadyFloor = flowService.calculateActiveCultivationOutcome(profile, {
    mode: 'steady',
    minigame: 'risk',
    performance: 'poor',
    choice: 'stabilize',
    random: () => 0,
  });
  const steadyPeak = flowService.calculateActiveCultivationOutcome(profile, {
    mode: 'steady',
    minigame: 'memory',
    performance: 'excellent',
    random: () => 0,
  });
  const focusedFloor = flowService.calculateActiveCultivationOutcome(profile, {
    mode: 'focused',
    minigame: 'risk',
    performance: 'poor',
    choice: 'stabilize',
    random: () => 0,
  });
  const focusedPeak = flowService.calculateActiveCultivationOutcome(profile, {
    mode: 'focused',
    minigame: 'timing',
    performance: 'excellent',
    random: () => 0,
  });
  const aggressiveFloor = flowService.calculateActiveCultivationOutcome(
    profile,
    {
      mode: 'aggressive',
      minigame: 'risk',
      performance: 'poor',
      choice: 'stabilize',
      random: () => 0,
    },
  );

  assert.ok(steadyFloor.cultivationGain < focusedFloor.cultivationGain);
  assert.ok(focusedFloor.cultivationGain < aggressiveFloor.cultivationGain);
  assert.ok(steadyPeak.cultivationGain > focusedFloor.cultivationGain);
  assert.ok(focusedPeak.cultivationGain > aggressiveFloor.cultivationGain);

  const meditationTickA = flowService.calculateMeditationTickOutcome(profile, {
    insightMeter: 0,
    roll: 1,
  });
  const meditationTickB = flowService.calculateMeditationTickOutcome(profile, {
    insightMeter: 1,
    roll: 1,
  });
  const combinedMeditationGain =
    meditationTickA.cultivationGain + meditationTickB.cultivationGain;

  assert.ok(aggressiveFloor.cultivationGain > combinedMeditationGain);
});

test('cultivation earn-rate buffs scale both active and meditation gain', () => {
  const baseProfile = makeProfile();
  const buffedProfile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      earnRateMultiplier: 6,
    },
  });

  const baseActive = flowService.calculateActiveCultivationOutcome(
    baseProfile,
    {
      mode: 'focused',
      minigame: 'timing',
      performance: 'good',
      random: () => 0,
    },
  );
  const buffedActive = flowService.calculateActiveCultivationOutcome(
    buffedProfile,
    {
      mode: 'focused',
      minigame: 'timing',
      performance: 'good',
      random: () => 0,
    },
  );

  assert.ok(buffedActive.cultivationGain > baseActive.cultivationGain * 3);

  const baseMeditation = flowService.calculateMeditationTickOutcome(
    baseProfile,
    {
      insightMeter: 0,
      roll: 1,
    },
  );
  const buffedMeditation = flowService.calculateMeditationTickOutcome(
    buffedProfile,
    {
      insightMeter: 0,
      roll: 1,
    },
  );

  assert.ok(
    buffedMeditation.cultivationGain > baseMeditation.cultivationGain * 3,
  );
});

test('techniques, preparation, and pills stack into stronger cultivation outcomes', () => {
  const baseProfile = makeProfile();
  const preparedProfile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      techniqueSlots: [
        'ember-breath-manual',
        'ember-breath-manual',
        'jade-meridian-circulation',
      ],
      breakthroughPreparationState: {
        selectedActions: ['stabilize-foundation', 'condense-qi'],
        stability: 1,
        condensation: 1,
        circulation: 0,
        lastPreparedAt: new Date().toISOString(),
      },
      pillBuffs: [
        {
          id: 'awakening-draught',
          grantedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          effects: {
            cultivationBaseGain: 12,
            breakthroughChanceBonus: 0.03,
            spiritEfficiencyBonus: 0.04,
            failurePenaltyReduction: 0.02,
          },
        },
      ],
    },
  });

  assert.deepEqual(
    normalizeTechniqueLoadout(preparedProfile.cultivation.techniqueSlots),
    ['ember-breath-manual', 'jade-meridian-circulation'],
  );
  assert.ok(
    summarizeTechniqueEffects(preparedProfile.cultivation.techniqueSlots)
      .cultivationBaseMultiplier > 0,
  );
  assert.ok(
    summarizePreparationEffects(
      preparedProfile.cultivation.breakthroughPreparationState,
    ).breakthroughChanceBonus > 0,
  );
  assert.ok(
    summarizeActivePillEffects(preparedProfile.cultivation.pillBuffs).cultivationBaseGain > 0,
  );

  const baseActive = flowService.calculateActiveCultivationOutcome(baseProfile, {
    mode: 'focused',
    minigame: 'timing',
    performance: 'good',
    random: () => 0,
  });
  const preparedActive = flowService.calculateActiveCultivationOutcome(
    preparedProfile,
    {
      mode: 'focused',
      minigame: 'timing',
      performance: 'good',
      random: () => 0,
    },
  );

  assert.ok(preparedActive.cultivationGain > baseActive.cultivationGain);

  const baseChance = calculateBreakthroughChance(baseProfile);
  const preparedChance = calculateBreakthroughChance(preparedProfile);
  assert.ok(preparedChance > baseChance);
});

test('admin cultivation rate stays hidden from player-facing embeds', () => {
  const profile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      earnRateMultiplier: 12,
    },
  });
  const outcome = flowService.calculateActiveCultivationOutcome(profile, {
    mode: 'steady',
    minigame: 'risk',
    performance: 'good',
    choice: 'push',
    random: () => 0,
  });

  const profileEmbed = createProfileEmbed(profile);
  const resultEmbed = createCultivateResultEmbed(profile, outcome, {
    title: 'Cultivation Complete',
  });

  assert.ok(!JSON.stringify(profileEmbed.data).includes('earnRateMultiplier'));
  assert.ok(!JSON.stringify(resultEmbed.data).includes('earnRateMultiplier'));
  assert.ok(!JSON.stringify(profileEmbed.data).includes('qiCurrent'));
  assert.ok(!JSON.stringify(resultEmbed.data).includes('qiCurrent'));
  assert.ok(!JSON.stringify(resultEmbed.data).includes('progressGain'));
});

test('breakthrough embeds keep the outcome clear and concise', () => {
  const readyProfile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      cultivationBase: 240,
      spiritEnergy: 24,
      qiCurrent: 24,
      realmIndex: null,
      stage: 0,
    },
    realm: null,
  });

  const successEmbed = createBreakthroughResultEmbed(readyProfile, {
    eligible: true,
    success: true,
    stage: 1,
    cultivationBase: 40,
    spiritEnergy: 0,
    spiritCost: 24,
    message: 'Awakening succeeds. Your mortal senses open.',
  });
  const failureEmbed = createBreakthroughResultEmbed(readyProfile, {
    eligible: true,
    success: false,
    stage: 0,
    cultivationBase: 160,
    spiritEnergy: 0,
    spiritCost: 24,
    setback: 18,
    message: 'Awakening fails. Spirit Energy is spent and Cultivation Base drops by 18.',
  });

  assert.match(successEmbed.data.description, /Awakening succeeds/i);
  assert.match(failureEmbed.data.description, /Awakening fails/i);
  assert.match(failureEmbed.data.description, /drops by 18/i);
  assert.ok(!JSON.stringify(successEmbed.data).includes('%'));
  assert.ok(!JSON.stringify(failureEmbed.data).includes('%'));
});

test('admin cultivation rate command exposes get, set, and clear controls', () => {
  const subcommands = cultivationRateCommand.data.options.map(
    (option) => option.name,
  );

  assert.deepEqual(subcommands, ['get', 'set', 'clear']);
  assert.equal(
    cultivationRateCommand.data.default_member_permissions,
    `${2 ** 3}`,
  );
});

test('developer override is treated as admin-only for command checks', () => {
  const devUserId = config.devs[0];
  const interaction = {
    inGuild: () => true,
    user: { id: devUserId },
    member: {
      permissions: {
        has: () => false,
      },
    },
  };

  assert.equal(canUseAdminCommands(interaction), true);
  assert.equal(canViewAdminCommands(interaction), true);
});

test('meditation ticks stay in memory and do not persist every cycle', async () => {
  const currentProfile = makeProfile();
  const sessionProfile = makeProfile({
    cultivation: {
      ...currentProfile.cultivation,
      meditationStartedAt: new Date().toISOString(),
    },
  });

  mock.method(
    flowService,
    'getCultivationStatusForDiscordUserId',
    async () => currentProfile,
  );
  mock.method(
    flowService,
    'startMeditationForDiscordUserId',
    async () => sessionProfile,
  );
  mock.method(flowService, 'stopActiveMeditationSession', async () => null);
  mock.method(
    flowService,
    'stopMeditationForDiscordUserId',
    async () => sessionProfile,
  );
  mock.method(flowService, 'registerMeditationSession', () => undefined);
  mock.method(flowService, 'clearMeditationSession', () => undefined);
  mock.method(
    flowService,
    'mergeCultivationProfile',
    (profile, cultivation) => ({
      ...profile,
      cultivation: {
        ...profile.cultivation,
        ...cultivation,
      },
    }),
  );

  let persistCalls = 0;
  mock.method(flowService, 'persistCultivationOutcome', async () => {
    persistCalls += 1;
    return { profile: sessionProfile, outcome: null };
  });
  mock.method(flowService, 'calculateMeditationTickOutcome', () => ({
    insightProc: false,
    nextInsightMeter: 1,
    progressGain: 7,
    cultivationGain: 11,
    cultivationBaseGain: 4,
    qiGain: 3,
    stage: sessionProfile.cultivation.stage,
    stageProgress: sessionProfile.cultivation.stageProgress + 7,
    cultivationBase: sessionProfile.cultivation.cultivationBase + 11,
    qiCurrent: sessionProfile.cultivation.qiCurrent + 3,
    lastProgressAt: new Date().toISOString(),
  }));

  let intervalCallback = null;
  mock.method(global, 'setInterval', (fn) => {
    intervalCallback = fn;
    return 1;
  });
  mock.method(global, 'clearInterval', () => undefined);

  const interaction = buildSessionInteraction('unit-user');
  await meditateCommand.execute(interaction);

  assert.equal(persistCalls, 0);
  assert.ok(intervalCallback);

  await intervalCallback();

  assert.equal(persistCalls, 0);
  assert.match(
    interaction.edits[0].embeds[0].data.description,
    /Meditation continues\./i,
  );
});

test('breakthrough pity increases odds and caps at sixty percent', () => {
  const baseProfile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: null,
      stage: 0,
      cultivationBase: 120,
      qiCurrent: 5,
      breakthroughFailures: 0,
    },
    realm: null,
    attributes: {
      physique: 0,
      comprehension: 0,
      spirit: 0,
      fortune: 0,
    },
    talent: {
      rootQuality: 0,
    },
  });
  const pityProfile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: null,
      stage: 0,
      cultivationBase: 120,
      qiCurrent: 5,
      breakthroughFailures: 4,
    },
    realm: null,
    attributes: {
      physique: 0,
      comprehension: 0,
      spirit: 0,
      fortune: 0,
    },
    talent: {
      rootQuality: 0,
    },
  });

  const baseChance = calculateBreakthroughChance(baseProfile);
  const pityChance = calculateBreakthroughChance(pityProfile);

  assert.ok(pityChance > baseChance);
  assert.ok(pityChance <= 0.6);
});

test('breakthrough consumes Spirit Energy until repeated attempts run dry', () => {
  let profile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: null,
      stage: 0,
      cultivationBase: 240,
      qiCurrent: 24,
      breakthroughFailures: 0,
    },
    realm: null,
  });

  const first = calculateBreakthroughOutcome(profile, { roll: 1 });
  assert.equal(first.eligible, true);
  assert.equal(first.success, false);

  profile = {
    ...profile,
    cultivation: {
      ...profile.cultivation,
      cultivationBase: first.cultivationBase,
      qiCurrent: first.qiCurrent,
      breakthroughFailures: first.breakthroughFailures,
    },
  };

  const second = calculateBreakthroughOutcome(profile, { roll: 1 });
  profile = {
    ...profile,
    cultivation: {
      ...profile.cultivation,
      cultivationBase: second.cultivationBase,
      qiCurrent: second.qiCurrent,
      breakthroughFailures: second.breakthroughFailures,
    },
  };

  const third = calculateBreakthroughOutcome(profile, { roll: 1 });
  assert.equal(third.eligible, false);
  assert.match(third.message, /Spirit Energy/i);
});

test('breakthrough success normalizes mortal carryover into stage one', () => {
  const profile = makeProfile({
    cultivation: {
      ...makeProfile().cultivation,
      realmIndex: null,
      stage: 0,
      stageProgress: 0,
      cultivationBase: 260,
      qiCurrent: 50,
      breakthroughFailures: 2,
    },
    realm: null,
  });

  const outcome = calculateBreakthroughOutcome(profile, { roll: 0 });
  assert.equal(outcome.success, true);
  assert.equal(outcome.realmIndex, 1);
  assert.equal(outcome.stage, 1);
  assert.ok(outcome.stageProgress > 0);
  assert.ok(outcome.stageProgress < 200);
});

function makeProfile(overrides = {}) {
  return {
    player: {
      id: 'player-1',
      discordUserId: 'unit-user',
    },
    character: {
      id: 'character-1',
      name: 'Test Cultivator',
    },
    realm: null,
    background: {
      key: 'commoner',
      name: 'Village Commoner',
      physiqueMod: 1,
      comprehensionMod: 0,
      spiritMod: 0,
      fortuneMod: 0,
    },
    attributes: {
      physique: 2,
      comprehension: 2,
      spirit: 2,
      fortune: 2,
    },
    talent: {
      rootQuality: 2,
    },
    status: {
      condition: 'stable',
      state: 'idle',
      meridianState: 'stable',
      dantianState: 'stable',
      mentalState: 'calm',
      hpCurrent: 10,
    },
    cultivation: {
      realmIndex: null,
      stage: 0,
      stageProgress: 0,
      cultivationBase: 0,
      earnRateMultiplier: 1,
      qiCurrent: 0,
      qiQuality: 2,
      foundationQuality: 1,
      lastProgressAt: new Date().toISOString(),
      lastBreakthroughAt: null,
      meditationStartedAt: null,
    },
    ...overrides,
  };
}

function buildSessionInteraction(userId) {
  const replies = [];
  const edits = [];
  const followUps = [];
  let collectorHandlers = null;
  const replyMessage = {
    id: `reply-${userId}`,
    createMessageComponentCollector() {
      const handlers = {};
      collectorHandlers = handlers;
      const collector = {
        on(event, handler) {
          handlers[event] = handler;
          return collector;
        },
        stop(reason) {
          queueMicrotask(() => {
            handlers.end?.(new Map(), reason);
          });
        },
      };

      return collector;
    },
  };

  return {
    user: {
      id: userId,
      username: `user-${userId}`,
    },
    guild: null,
    guildId: null,
    member: null,
    client: {},
    options: {
      getSubcommand: () => 'start',
      getString: () => null,
      getFocused: () => '',
    },
    reply: async (payload) => {
      replies.push(payload);
      if (payload.fetchReply) {
        return replyMessage;
      }
      return payload;
    },
    editReply: async (payload) => {
      edits.push(payload);
      return payload;
    },
    followUp: async (payload) => {
      followUps.push(payload);
      return payload;
    },
    replies,
    edits,
    followUps,
    triggerComponent: async (customId = 'meditate-stop') => {
      if (!collectorHandlers) {
        return null;
      }

      const componentInteraction = {
        user: { id: userId },
        customId,
        message: { id: replyMessage.id },
        deferUpdate: async () => {},
        update: async (payload) => {
          edits.push(payload);
          return payload;
        },
      };

      if (typeof collectorHandlers.collect === 'function') {
        await collectorHandlers.collect(componentInteraction);
      }

      return componentInteraction;
    },
  };
}
