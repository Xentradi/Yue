const assert = require('node:assert/strict');
const test = require('node:test');

const cache = require('../../src/storage/cache');
const {
  ensureSchema,
  closePool,
  query,
} = require('../../src/storage/postgres');
const {
  clearCultivationReferenceCache,
  listBackgroundDefinitions,
} = require('../../src/storage/cultivationRepository');
const profileCommand = require('../../src/commands/cultivation/profile');
const cultivationCommand = require('../../src/commands/cultivation/cultivation');
const startCommand = require('../../src/commands/cultivation/start');
const cultivateCommand = require('../../src/commands/cultivation/cultivate');
const meditateCommand = require('../../src/commands/cultivation/meditate');
const breakthroughCommand = require('../../src/commands/cultivation/breakthrough');
const {
  getCultivationStatusForDiscordUserId,
  calculateMeditationTickOutcome,
} = require('../../src/modules/cultivation/flowService');
const {
  formatBackgroundEffectSummary,
  createProfileEmbed,
  createMeditationTickEmbed,
  createCultivateResultEmbed,
} = require('../../src/modules/cultivation/flowPresentation');
const {
  buildCultivationChallenge,
  evaluateCultivationChallenge,
} = require('../../src/modules/cultivation/minigames');
const {
  calculateActiveCultivationOutcome,
} = require('../../src/modules/cultivation/flowService');

test.before(async () => {
  await ensureSchema();
});

test.after(async () => {
  await closePool();
  await cache.closeClient();
});

test.beforeEach(async () => {
  await query('DELETE FROM players;');
  clearCultivationReferenceCache();
});

test('reference data cache reuses background lookup results', async () => {
  let queryCount = 0;
  const client = {
    async query() {
      queryCount += 1;
      return {
        rows: [
          {
            id: 'cache-test-id',
            key: 'cache-test',
            name: 'Cache Test',
            description: 'Cache test',
            physique_mod: 1,
            comprehension_mod: 0,
            spirit_mod: 0,
            fortune_mod: 0,
          },
        ],
      };
    },
  };

  const first = await listBackgroundDefinitions({ client });
  const second = await listBackgroundDefinitions({ client });

  assert.equal(first[0].key, 'cache-test');
  assert.equal(second[0].key, 'cache-test');
  assert.equal(queryCount, 1);
});

test('profile command shows onboarding guidance when no character exists', async () => {
  const interaction = buildInteraction({ userId: 'discord-user-1' });

  await profileCommand.execute(interaction);

  const payload = interaction.replies[0];
  assert.ok(payload);
  assert.equal(payload.flags, 64);
  assert.equal(payload.embeds[0].data.title, '🌱 Begin the Mortal Path');
  assert.match(payload.embeds[0].data.description, /\/start/);
  assert.deepEqual(
    payload.embeds[0].data.fields.map((field) => field.name),
    ['Quick Start', 'Path Choices', 'First Step', 'Backgrounds'],
  );
});

test('start command creates a cultivator and duplicate messaging references real commands', async () => {
  const first = buildInteraction({
    userId: 'discord-user-2',
    options: {
      name: 'Liu Mei',
      background: 'scholar',
      path: 'qi',
    },
  });

  await startCommand.execute(first);
  assert.equal(first.replies[0].embeds[0].data.title, '⚔️ Mortal Born');
  const backgroundField = first.replies[0].embeds[0].data.fields.find(
    (field) => field.name === 'Background',
  );
  assert.ok(backgroundField);
  assert.match(backgroundField.value, /Favors/);
  assert.deepEqual(
    first.replies[0].embeds[0].data.fields.map((field) => field.name),
    ['Background', 'Realm', 'Stage', 'Cultivation Base', 'Spirit Energy'],
  );
  assert.ok(
    first.replies[0].embeds[0].data.fields.some(
      (field) => field.name === 'Spirit Energy',
    ),
  );

  const duplicate = buildInteraction({
    userId: 'discord-user-2',
    options: {
      name: 'Liu Mei Duplicate',
      background: 'commoner',
      path: 'body',
    },
  });

  await startCommand.execute(duplicate);
  const duplicateDescription = duplicate.replies[0].embeds[0].data.description;
  assert.equal(
    duplicate.replies[0].embeds[0].data.title,
    '⚠️ Character Already Exists',
  );
  assert.ok(!duplicateDescription.includes('/cultivation'));
  assert.match(duplicateDescription, /\/profile/);
  assert.match(duplicateDescription, /\/cultivate/);
  assert.match(duplicateDescription, /\/meditate/);
  assert.match(duplicateDescription, /\/breakthrough/);
});

test('cultivation hub manages techniques, preparation, and pills', async () => {
  const starter = buildInteraction({
    userId: 'discord-user-2b',
    options: {
      name: 'Qiu Lan',
      background: 'scholar',
      path: 'qi',
    },
  });
  await startCommand.execute(starter);

  const equipInteraction = buildInteraction({
    userId: 'discord-user-2b',
    options: {
      subcommand: 'equip',
      first: 'ember-breath-manual',
      second: 'jade-meridian-circulation',
    },
  });
  await cultivationCommand.execute(equipInteraction);
  assert.match(
    equipInteraction.replies[0].embeds[0].data.description,
    /techniques are now/i,
  );

  const prepareInteraction = buildInteraction({
    userId: 'discord-user-2b',
    options: {
      subcommand: 'prepare',
      stabilize: true,
      condense: true,
      circulate: false,
    },
  });
  await cultivationCommand.execute(prepareInteraction);
  assert.match(
    prepareInteraction.replies[0].embeds[0].data.description,
    /prepare with/i,
  );

  const grantInteraction = buildInteraction({
    userId: 'discord-user-2b',
    options: {
      subcommand: 'pill',
      action: 'grant',
      pill: 'awakening-draught',
      quantity: 2,
    },
  });
  await cultivationCommand.execute(grantInteraction);
  assert.match(
    grantInteraction.replies[0].embeds[0].data.description,
    /added to your inventory/i,
  );

  const consumeInteraction = buildInteraction({
    userId: 'discord-user-2b',
    options: {
      subcommand: 'pill',
      action: 'consume',
      pill: 'awakening-draught',
    },
  });
  await cultivationCommand.execute(consumeInteraction);
  assert.match(
    consumeInteraction.replies[0].embeds[0].data.description,
    /refines your cultivation/i,
  );

  const refreshed = await getCultivationStatusForDiscordUserId('discord-user-2b');
  assert.deepEqual(refreshed.cultivation.techniqueSlots, [
    'ember-breath-manual',
    'jade-meridian-circulation',
  ]);
  assert.ok(
    refreshed.cultivation.breakthroughPreparationState.selectedActions.includes(
      'stabilize-foundation',
    ),
  );
  assert.equal(refreshed.cultivation.pillCounters['awakening-draught'], 2);
  assert.ok(refreshed.cultivation.pillBuffs.length > 0);
  assert.ok(refreshed.cultivation.cultivationBase > 0);
});

test('background presentation uses plain-language effect summaries', async () => {
  const backgrounds = await listBackgroundDefinitions();
  const scholar = backgrounds.find(
    (background) => background.key === 'scholar',
  );
  assert.ok(scholar);
  assert.match(formatBackgroundEffectSummary(scholar), /Favors/);

  const autocompleteInteraction = buildInteraction({
    userId: 'discord-user-2a',
  });
  let respondedChoices = [];
  autocompleteInteraction.options.getFocused = () => 'sch';
  autocompleteInteraction.respond = async (choices) => {
    respondedChoices = choices;
    return choices;
  };

  await startCommand.autocomplete(autocompleteInteraction);
  assert.ok(respondedChoices.length > 0);
  assert.match(respondedChoices[0].name, /Favors|weaker/);
});

test('passive gain accrues when a relevant interaction occurs', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-3',
    options: {
      name: 'Shen Li',
      background: 'temple-orphan',
      path: 'balanced',
    },
  });

  await startCommand.execute(interaction);
  const { rows } = await query(
    `
      UPDATE character_cultivation
      SET last_progress_at = NOW() - INTERVAL '30 seconds',
          stage_progress = 0,
          cultivation_base = 0,
          qi_current = 0
      FROM characters
      JOIN players ON players.id = characters.player_id
      WHERE characters.id = character_cultivation.character_id
        AND players.discord_user_id = $1
      RETURNING character_cultivation.character_id;
    `,
    ['discord-user-3'],
  );

  assert.equal(rows.length, 1);

  const refreshed =
    await getCultivationStatusForDiscordUserId('discord-user-3');
  assert.ok(refreshed.cultivation.stageProgress > 0);
  assert.ok(refreshed.cultivation.qiCurrent > 0);

  const profileEmbed = createProfileEmbed(refreshed);
  assert.deepEqual(
    profileEmbed.data.fields.map((field) => field.name),
    ['Realm', 'Stage', 'Cultivation Base', 'Spirit Energy', 'Next Step'],
  );
  assert.match(profileEmbed.data.description, /awakening|breakthrough/i);
  assert.ok(profileEmbed.data.fields.at(-1).value.includes('/'));
});

test('meditation start streams a private session and stop clears the lockout', async () => {
  const startInteraction = buildSessionInteraction({
    userId: 'discord-user-4',
    subcommand: 'start',
  });

  await startCommand.execute(
    buildInteraction({
      userId: 'discord-user-4',
      options: {
        name: 'Ming Dao',
        background: 'hermit',
        path: 'qi',
      },
    }),
  );

  await meditateCommand.execute(startInteraction);
  assert.ok(startInteraction.replies[0].components.length > 0);

  const lockedCultivate = buildInteraction({
    userId: 'discord-user-4',
    options: { mode: 'steady' },
  });
  await cultivateCommand.execute(lockedCultivate);
  assert.match(
    lockedCultivate.replies[0].embeds[0].data.description,
    /already meditating/i,
  );

  startInteraction.triggerComponent('meditate-stop');
  await flushMicrotasks();

  const stopInteraction = buildSessionInteraction({
    userId: 'discord-user-4',
    subcommand: 'stop',
  });
  await meditateCommand.execute(stopInteraction);

  const refreshed =
    await getCultivationStatusForDiscordUserId('discord-user-4');
  assert.equal(refreshed.cultivation.meditationStartedAt, null);
});

test('meditation tick math surfaces insight procs and misses', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-5',
    options: {
      name: 'Zhao Yun',
      background: 'battlefield-survivor',
      path: 'body',
    },
  });

  await startCommand.execute(interaction);
  const profile = await getCultivationStatusForDiscordUserId('discord-user-5');
  const baseOutcome = calculateMeditationTickOutcome(
    {
      ...profile,
      cultivation: {
        ...profile.cultivation,
        meditationStartedAt: new Date().toISOString(),
      },
    },
    { insightMeter: 0, roll: 0 },
  );
  const missedOutcome = calculateMeditationTickOutcome(
    {
      ...profile,
      cultivation: {
        ...profile.cultivation,
        meditationStartedAt: new Date().toISOString(),
      },
    },
    { insightMeter: 3, roll: 1 },
  );

  assert.equal(baseOutcome.insightProc, true);
  assert.ok(baseOutcome.progressGain > 0);
  assert.equal(missedOutcome.insightProc, false);
  assert.ok(missedOutcome.nextInsightMeter > 3);

  const tickEmbed = createMeditationTickEmbed(profile, baseOutcome, 1);
  assert.deepEqual(
    tickEmbed.data.fields.map((field) => field.name),
    ['Realm', 'Stage', 'Cultivation Base', 'Spirit Energy'],
  );
  assert.ok(!tickEmbed.data.description.includes('%'));
  assert.ok(!tickEmbed.data.description.includes('Total:'));
  assert.match(tickEmbed.data.description, /Cultivation Base/i);
});

test('meditation insight pity guarantees a proc by the cap', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-5b',
    options: {
      name: 'Yue Ling',
      background: 'hermit',
      path: 'qi',
    },
  });

  await startCommand.execute(interaction);
  const profile = await getCultivationStatusForDiscordUserId('discord-user-5b');
  const guaranteedOutcome = calculateMeditationTickOutcome(
    {
      ...profile,
      cultivation: {
        ...profile.cultivation,
        meditationStartedAt: new Date().toISOString(),
      },
    },
    { insightMeter: 60, roll: 1 },
  );

  assert.equal(guaranteedOutcome.insightProc, true);
  assert.equal(guaranteedOutcome.nextInsightMeter, 0);
});

test('active cultivation mode behavior changes by mode and minigame outcome', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-6',
    options: {
      name: 'Han Song',
      background: 'merchant',
      path: 'balanced',
    },
  });

  await startCommand.execute(interaction);
  const profile = await getCultivationStatusForDiscordUserId('discord-user-6');

  const timingChallenge = buildCultivationChallenge(profile, 'focused', {
    roll: 0,
  });
  assert.ok(['timing', 'memory', 'risk'].includes(timingChallenge.minigame));

  const timingEvaluation = evaluateCultivationChallenge(timingChallenge, {
    choice: 'strike',
    responseTimeMs: timingChallenge.context.targetDelayMs,
  });
  assert.notEqual(timingEvaluation.performance, 'poor');

  const steadyOutcome = calculateActiveCultivationOutcome(profile, {
    mode: 'steady',
    minigame: timingChallenge.minigame,
    performance: 'good',
    random: () => 0,
  });
  const aggressiveOutcome = calculateActiveCultivationOutcome(profile, {
    mode: 'aggressive',
    minigame: timingChallenge.minigame,
    performance: 'excellent',
    random: () => 0,
  });

  assert.ok(aggressiveOutcome.progressGain > steadyOutcome.progressGain);
  assert.ok(aggressiveOutcome.qiGain >= steadyOutcome.qiGain);
  const focusedOutcome = calculateActiveCultivationOutcome(profile, {
    mode: 'focused',
    minigame: timingChallenge.minigame,
    performance: 'normal',
    random: () => 0,
  });
  assert.ok(steadyOutcome.cultivationGain < focusedOutcome.cultivationGain);
  assert.ok(focusedOutcome.cultivationGain < aggressiveOutcome.cultivationGain);
});

test('memory and timing minigames match their prompts and buttons', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-6b',
    options: {
      name: 'Han Yue',
      background: 'scholar',
      path: 'qi',
    },
  });

  await startCommand.execute(interaction);
  const profile = await getCultivationStatusForDiscordUserId('discord-user-6b');

  const timingChallenge = buildCultivationChallenge(profile, 'focused', {
    roll: 0,
  });
  assert.match(timingChallenge.prompt, /bright center window/i);
  assert.match(timingChallenge.prompt, /Timing window:/i);
  assert.match(timingChallenge.prompt, /🟩/);
  assert.deepEqual(timingChallenge.buttons.map((button) => button.id).sort(), [
    'abort',
    'strike',
  ]);

  const memoryChallenge = buildCultivationChallenge(profile, 'steady', {
    roll: 0.55,
    memoryQuestionType: 'second',
    random: () => 0,
  });
  assert.match(memoryChallenge.prompt, /Which was second\?/i);
  assert.equal(memoryChallenge.buttons.length, 3);
  assert.ok(
    memoryChallenge.buttons.every((button) =>
      ['azure', 'ember', 'jade', 'void', 'iron', 'mist'].includes(button.id),
    ),
  );
  assert.notDeepEqual(
    memoryChallenge.buttons.map((button) => button.id),
    memoryChallenge.context.shownGlyphs,
  );
});

test('risk mode push and stabilize produce different outcomes', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-6c',
    options: {
      name: 'Shen Wen',
      background: 'merchant',
      path: 'balanced',
    },
  });

  await startCommand.execute(interaction);
  const profile = await getCultivationStatusForDiscordUserId('discord-user-6c');

  const pushOutcome = calculateActiveCultivationOutcome(profile, {
    mode: 'aggressive',
    minigame: 'risk',
    performance: 'excellent',
    choice: 'push',
    roll: 0.2,
  });
  const stabilizeOutcome = calculateActiveCultivationOutcome(profile, {
    mode: 'aggressive',
    minigame: 'risk',
    performance: 'good',
    choice: 'stabilize',
    roll: 0.2,
  });

  assert.ok(pushOutcome.cultivationGain > stabilizeOutcome.cultivationGain);
  assert.notEqual(pushOutcome.strained, stabilizeOutcome.strained);
});

test('breakthrough remains simple and returns an actionable result once eligible', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-7',
    options: {
      name: 'Chen Hua',
      background: 'commoner',
      path: 'balanced',
    },
  });

  await startCommand.execute(interaction);
  await query(
    `
      UPDATE character_cultivation
      SET stage_progress = 0,
          cultivation_base = 240,
          spirit_energy = 24,
          qi_current = 24,
          breakthrough_failures = 0,
          realm_index = NULL,
          stage = 0
      FROM characters
      JOIN players ON players.id = characters.player_id
      WHERE characters.id = character_cultivation.character_id
        AND players.discord_user_id = $1;
    `,
    ['discord-user-7'],
  );

  const breakthroughInteraction = buildInteraction({
    userId: 'discord-user-7',
  });
  await breakthroughCommand.execute(breakthroughInteraction);
  assert.match(
    breakthroughInteraction.replies[0].embeds[0].data.title,
    /^(Awakening|Breakthrough) (Success|Failed|Not Ready)$/,
  );
  assert.deepEqual(
    breakthroughInteraction.replies[0].embeds[0].data.fields.map(
      (field) => field.name,
    ),
    [
      'Realm',
      'Stage',
      'Cultivation Base',
      'Spirit Energy',
      'Spirit Energy Cost',
      'Next Step',
    ],
  );
  assert.ok(
    !breakthroughInteraction.replies[0].embeds[0].data.description.includes(
      '%',
    ),
  );
});

test('cultivation result messaging stays simplified', async () => {
  const interaction = buildInteraction({
    userId: 'discord-user-8',
    options: {
      name: 'Li Shan',
      background: 'scholar',
      path: 'qi',
    },
  });

  await startCommand.execute(interaction);
  const profile = await getCultivationStatusForDiscordUserId('discord-user-8');
  const outcome = calculateActiveCultivationOutcome(profile, {
    mode: 'focused',
    minigame: 'timing',
    performance: 'good',
  });

  const embed = createCultivateResultEmbed(profile, outcome, {
    title: 'Cultivation Complete',
  });

  assert.match(embed.data.description, /You refine your cultivation base\./i);
  assert.match(embed.data.description, /\+\d+ Cultivation Base/);
  assert.match(embed.data.description, /\+\d+ Spirit Energy/);
  assert.ok(!embed.data.description.includes('cultivationBase'));
  assert.ok(!embed.data.description.includes('qiCurrent'));
  assert.ok(!embed.data.description.includes('progressGain'));
  assert.ok(!embed.data.description.includes('Total:'));
});

function buildInteraction({ userId, options = {} } = {}) {
  const replies = [];
  const edits = [];
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
      getSubcommand: () => options.subcommand ?? null,
      getString: (name) => options[name] ?? null,
      getBoolean: (name) => options[name] ?? null,
      getInteger: (name) => options[name] ?? null,
      getFocused: () => '',
    },
    reply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    editReply: async (payload) => {
      edits.push(payload);
      return payload;
    },
    replies,
    edits,
  };
}

function buildSessionInteraction({
  userId,
  subcommand,
  autoButtonId = null,
} = {}) {
  const interaction = buildInteraction({
    userId,
    options: { subcommand },
  });
  let lastReplyPayload = null;
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
          queueMicrotask(() => handlers.end?.(new Map(), reason));
        },
      };

      return collector;
    },
  };

  interaction.reply = async (payload) => {
    lastReplyPayload = payload;
    interaction.replies.push(payload);
    if (payload.fetchReply) {
      return replyMessage;
    }
    return payload;
  };

  interaction.editReply = async (payload) => {
    interaction.edits.push(payload);
    return payload;
  };

  Object.defineProperty(interaction, 'lastReplyPayload', {
    get: () => lastReplyPayload,
  });

  interaction.triggerComponent = async (customId = autoButtonId) => {
    if (!collectorHandlers) {
      return null;
    }

    const componentInteraction = {
      user: { id: userId },
      customId,
      message: { id: replyMessage.id },
      deferUpdate: async () => {},
      update: async (payload) => {
        interaction.edits.push(payload);
        return payload;
      },
    };

    if (typeof collectorHandlers.collect === 'function') {
      await collectorHandlers.collect(componentInteraction);
    }

    return componentInteraction;
  };

  return interaction;
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}
