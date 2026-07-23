const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { createStatusEmbed } = require('../../utils/economyFeedback');
const { getOptionBoolean, getOptionInteger, getOptionString } = require('../../utils/interactionHelpers');
const flowService = require('../../modules/cultivation/flowService');
const {
  PILL_DEFINITIONS,
  TECHNIQUE_DEFINITIONS,
  getPreparationActionDefinition,
  getTechniqueDefinition,
  resolveTechniqueLoadout,
  summarizeActivePillEffects,
  summarizePreparationEffects,
  summarizeTechniqueEffects,
} = require('../../modules/cultivation/loadoutCatalog');

const NONE_VALUE = 'none';
const TECHNIQUE_CHOICES = [
  { name: 'None', value: NONE_VALUE },
  ...TECHNIQUE_DEFINITIONS.map((definition) => ({
    name: definition.name,
    value: definition.id,
  })),
];
const PILL_CHOICES = PILL_DEFINITIONS.map((definition) => ({
  name: definition.name,
  value: definition.id,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cultivation')
    .setDescription('Manage cultivation techniques, preparation, and pills.')
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Review your cultivation loadout.'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('equip')
        .setDescription('Equip up to two cultivation techniques.')
        .addStringOption((option) =>
          option
            .setName('first')
            .setDescription('First technique slot')
            .addChoices(...TECHNIQUE_CHOICES)
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('second')
            .setDescription('Second technique slot')
            .addChoices(...TECHNIQUE_CHOICES)
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('prepare')
        .setDescription('Set breakthrough preparation actions.')
        .addBooleanOption((option) =>
          option
            .setName('stabilize')
            .setDescription('Stabilize the foundation')
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('condense')
            .setDescription('Condense the qi')
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('circulate')
            .setDescription('Circulate the meridians')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pill')
        .setDescription('Grant or consume a cultivation pill.')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('What to do with the pill')
            .setRequired(true)
            .addChoices(
              { name: 'Grant', value: 'grant' },
              { name: 'Consume', value: 'consume' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('pill')
            .setDescription('The pill to grant or consume')
            .setRequired(true)
            .addChoices(...PILL_CHOICES),
        )
        .addIntegerOption((option) =>
          option
            .setName('quantity')
            .setDescription('How many pills to grant')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(99),
        ),
    ),
  hidden: true,
  cooldown: 1,
  deployGlobal: true,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      return await executeStatus(interaction);
    }

    if (subcommand === 'equip') {
      return await executeEquip(interaction);
    }

    if (subcommand === 'prepare') {
      return await executePrepare(interaction);
    }

    return await executePill(interaction);
  },
};

async function executeStatus(interaction) {
  const profile = await flowService.getCultivationStatusForDiscordUserId(
    interaction.user.id,
  );
  if (!profile) {
    return interaction.reply({
      content: 'Use `/start` first to begin your mortal path.',
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    embeds: [createLoadoutStatusEmbed(profile)],
    flags: MessageFlags.Ephemeral,
  });
}

async function executeEquip(interaction) {
  const profile = await flowService.getCultivationStatusForDiscordUserId(
    interaction.user.id,
  );
  if (!profile) {
    return interaction.reply({
      content: 'Use `/start` first to begin your mortal path.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const selectedTechniqueIds = [
    getOptionString(interaction, 'first') ?? NONE_VALUE,
    getOptionString(interaction, 'second') ?? NONE_VALUE,
  ].filter((value) => value !== NONE_VALUE);

  const updatedProfile =
    await flowService.equipCultivationTechniquesForDiscordUserId(
      interaction.user.id,
      selectedTechniqueIds,
    );

  return interaction.reply({
    embeds: [
      createStatusEmbed({
        title: '🧾 Techniques Equipped',
        description: selectedTechniqueIds.length
          ? `Your techniques are now ${describeTechniqueLoadout(updatedProfile)}.`
          : 'You cleared your technique slots.',
        color: '#7db6ff',
        fields: [
          {
            name: 'Cultivation Base Bonus',
            value: `${formatPercent(
              summarizeTechniqueEffects(
                updatedProfile?.cultivation?.techniqueSlots ?? [],
              ).cultivationBaseMultiplier,
            )}`,
            inline: true,
          },
          {
            name: 'Breakthrough Bonus',
            value: `${formatPercent(
              summarizeTechniqueEffects(
                updatedProfile?.cultivation?.techniqueSlots ?? [],
              ).breakthroughChanceBonus,
            )}`,
            inline: true,
          },
        ],
      }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function executePrepare(interaction) {
  const profile = await flowService.getCultivationStatusForDiscordUserId(
    interaction.user.id,
  );
  if (!profile) {
    return interaction.reply({
      content: 'Use `/start` first to begin your mortal path.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const selectedActions = [];
  if (getOptionBoolean(interaction, 'stabilize')) {
    selectedActions.push('stabilize-foundation');
  }
  if (getOptionBoolean(interaction, 'condense')) {
    selectedActions.push('condense-qi');
  }
  if (getOptionBoolean(interaction, 'circulate')) {
    selectedActions.push('circulate-meridians');
  }

  const updatedProfile =
    await flowService.prepareCultivationBreakthroughForDiscordUserId(
      interaction.user.id,
      selectedActions,
    );

  const summary = summarizePreparationEffects(
    updatedProfile?.cultivation?.breakthroughPreparationState ?? {},
  );

  return interaction.reply({
    embeds: [
      createStatusEmbed({
        title: '🌀 Breakthrough Preparation Set',
        description: selectedActions.length
          ? `You prepare with ${describePreparationActions(selectedActions)}.`
          : 'You clear your preparation state.',
        color: '#4dd4ac',
        fields: [
          {
            name: 'Breakthrough Bonus',
            value: `${formatPercent(summary.breakthroughChanceBonus)}`,
            inline: true,
          },
          {
            name: 'Failure Relief',
            value: `${formatPercent(summary.failurePenaltyReduction)}`,
            inline: true,
          },
        ],
      }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function executePill(interaction) {
  const action = getOptionString(interaction, 'action') ?? 'consume';
  const pillId = getOptionString(interaction, 'pill');
  const quantity = getOptionInteger(interaction, 'quantity') ?? 1;
  const pillDefinition = getPillDefinitionById(pillId);

  if (!pillDefinition) {
    return interaction.reply({
      content: 'Choose a valid pill first.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === 'grant') {
    const updatedProfile =
      await flowService.grantCultivationPillForDiscordUserId(
        interaction.user.id,
        pillId,
        quantity,
      );

    return interaction.reply({
      embeds: [
        createStatusEmbed({
          title: '💊 Pill Granted',
          description: `${quantity} ${pillDefinition.name} added to your inventory.`,
          color: '#7db6ff',
          fields: [
            {
              name: 'Inventory',
              value: describePillInventory(updatedProfile?.cultivation?.pillCounters ?? {}),
              inline: false,
            },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  const updatedProfile = await flowService.consumeCultivationPillForDiscordUserId(
    interaction.user.id,
    pillId,
  );

  if (!updatedProfile) {
    return interaction.reply({
      content: 'You do not have that pill available.',
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    embeds: [
      createStatusEmbed({
        title: '💊 Pill Consumed',
        description: `${pillDefinition.name} refines your cultivation. +${pillDefinition.effects.cultivationBaseGain} Cultivation Base.`,
        color: '#4dd4ac',
        fields: [
          {
            name: 'Inventory',
            value: describePillInventory(updatedProfile?.cultivation?.pillCounters ?? {}),
            inline: false,
          },
          {
            name: 'Active Buffs',
            value: describeActivePillBuffs(updatedProfile?.cultivation?.pillBuffs ?? []),
            inline: false,
          },
        ],
      }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

function getPillDefinitionById(pillId) {
  return PILL_DEFINITIONS.find((definition) => definition.id === pillId) ?? null;
}

function createLoadoutStatusEmbed(profile) {
  const techniqueNames = describeTechniqueLoadout(profile);
  const preparationNames = describePreparationActions(
    profile?.cultivation?.breakthroughPreparationState?.selectedActions ?? [],
  );
  const pillInventory = describePillInventory(
    profile?.cultivation?.pillCounters ?? {},
  );
  const activeBuffs = describeActivePillBuffs(
    profile?.cultivation?.pillBuffs ?? [],
  );

  return createStatusEmbed({
    title: '📜 Cultivation Loadout',
    description:
      'Techniques, preparation, and pills now reinforce your cultivation loop.',
    color: '#7db6ff',
    fields: [
      { name: 'Techniques', value: techniqueNames, inline: false },
      { name: 'Preparation', value: preparationNames, inline: false },
      { name: 'Pills', value: pillInventory, inline: false },
      { name: 'Active Buffs', value: activeBuffs, inline: false },
    ],
  });
}

function describeTechniqueLoadout(profile) {
  const names = resolveTechniqueLoadout(profile?.cultivation?.techniqueSlots ?? []).map(
    (techniqueId) => getTechniqueDefinition(techniqueId)?.name ?? techniqueId,
  );

  return names.length ? names.join(', ') : 'None equipped';
}

function describePreparationActions(actionIds = []) {
  const names = actionIds
    .map((actionId) => getPreparationActionDefinition(actionId)?.name ?? null)
    .filter(Boolean);

  return names.length ? names.join(', ') : 'None active';
}

function describePillInventory(pillCounters = {}) {
  const entries = Object.entries(pillCounters)
    .map(([pillId, count]) => {
      const definition = getPillDefinitionById(pillId);
      if (!definition || count <= 0) {
        return null;
      }

      return `${definition.name}: ${count}`;
    })
    .filter(Boolean);

  return entries.length ? entries.join('\n') : 'No pills stored';
}

function describeActivePillBuffs(pillBuffs = []) {
  const activeSummary = summarizeActivePillEffects(pillBuffs, new Date());
  if (!pillBuffs.length) {
    return 'No active pill buffs';
  }

  return [
    `Cultivation Base Gain: +${activeSummary.cultivationBaseGain}`,
    `Breakthrough Bonus: ${formatPercent(activeSummary.breakthroughChanceBonus)}`,
    `Spirit Efficiency Bonus: ${formatPercent(activeSummary.spiritEfficiencyBonus)}`,
    `Failure Relief: ${formatPercent(activeSummary.failurePenaltyReduction)}`,
  ].join('\n');
}

function formatPercent(value) {
  const numeric = Number(value) || 0;
  const percentage = Math.round(numeric * 100);
  return `${percentage}%`;
}
