const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');
const {
  calculateActiveCultivationOutcome,
  getCultivationStatusForDiscordUserId,
  persistCultivationOutcome,
} = require('../../modules/cultivation/flowService');
const {
  buildCultivationChallenge,
  evaluateCultivationChallenge,
} = require('../../modules/cultivation/minigames');
const {
  createCultivationPromptEmbed,
  createCultivateResultEmbed,
  createActionLockEmbed,
  createOnboardingEmbed,
} = require('../../modules/cultivation/flowPresentation');
const { listBackgroundDefinitions } = require('../../storage/cultivationRepository');
const { getOptionString } = require('../../utils/interactionHelpers');

const BUTTON_STYLE = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Danger: ButtonStyle.Danger,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cultivate')
    .setDescription('Run an active cultivation technique.')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Cultivation technique')
        .setRequired(true)
        .addChoices(
          { name: 'Steady', value: 'steady' },
          { name: 'Focused', value: 'focused' },
          { name: 'Aggressive', value: 'aggressive' },
        ),
    ),
  cooldown: 4,
  deployGlobal: true,

  async execute(interaction) {
    const mode = getOptionString(interaction, 'mode') ?? 'steady';
    const profile = await getCultivationStatusForDiscordUserId(interaction.user.id);

    if (!profile) {
      const embed = createOnboardingEmbed(await listBackgroundDefinitions());
      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (profile.cultivation?.meditationStartedAt) {
      return interaction.reply({
        embeds: [
          createActionLockEmbed(
            'Cultivation Locked',
            'You are already meditating. Stop meditation before running an active cultivation session.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const challenge = buildCultivationChallenge(profile, mode, {
      random: Math.random,
    });
    const promptStartedAt = Date.now();
    const row = new ActionRowBuilder().addComponents(
      challenge.buttons.map((button) =>
        new ButtonBuilder()
          .setCustomId(button.id)
          .setLabel(button.label)
          .setStyle(BUTTON_STYLE[button.style] ?? ButtonStyle.Primary),
      ),
    );

    const replyMessage = await interaction.reply({
      embeds: [
        createCultivationPromptEmbed(
          profile,
          mode,
          challenge.minigame,
          challenge.prompt,
        ),
      ],
      components: [row],
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

    if (typeof replyMessage?.createMessageComponentCollector !== 'function') {
      const evaluation = evaluateCultivationChallenge(challenge, {
        choice: 'strike',
        responseTimeMs: 0,
      });
      const outcome = calculateActiveCultivationOutcome(profile, {
        mode,
        minigame: challenge.minigame,
        performance: evaluation.performance,
        choice: evaluation.choice,
      });
      const persisted = await persistCultivationOutcome(profile, outcome, {});
      return interaction.editReply({
        embeds: [
          createCultivateResultEmbed(
            persisted.profile,
            {
              ...outcome,
              performance: evaluation.performance,
              minigame: challenge.minigame,
            },
            {
              title: 'Cultivation Complete',
              description: evaluation.detail,
            },
          ),
        ],
        components: [],
      });
    }

    let settled = false;
    const collector = replyMessage.createMessageComponentCollector({
      filter: (componentInteraction) =>
        componentInteraction.user.id === interaction.user.id &&
        componentInteraction.message.id === replyMessage.id &&
        challenge.buttons.some((button) => button.id === componentInteraction.customId),
      time: 15000,
      max: 1,
    });

    collector.on('collect', async (componentInteraction) => {
      settled = true;
      await componentInteraction.deferUpdate();
      const responseTimeMs = Date.now() - promptStartedAt;
      const evaluation = evaluateCultivationChallenge(challenge, {
        choice: componentInteraction.customId,
        responseTimeMs,
      });
      const outcome = calculateActiveCultivationOutcome(profile, {
        mode,
        minigame: challenge.minigame,
        performance: evaluation.performance,
        choice: evaluation.choice,
      });
      const persisted = await persistCultivationOutcome(profile, outcome, {});
      await interaction.editReply({
        embeds: [
          createCultivateResultEmbed(
            persisted.profile,
            {
              ...outcome,
              performance: evaluation.performance,
              minigame: challenge.minigame,
            },
            {
              title: evaluation.success ? 'Cultivation Complete' : 'Cultivation Strained',
              description: evaluation.detail,
            },
          ),
        ],
        components: [],
      });
      collector.stop('resolved');
    });

    collector.on('end', async (_collected, reason) => {
      if (settled) {
        return;
      }

      const evaluation = evaluateCultivationChallenge(challenge, {
        choice: 'timeout',
        responseTimeMs: 9999,
      });
      const outcome = calculateActiveCultivationOutcome(profile, {
        mode,
        minigame: challenge.minigame,
        performance: evaluation.performance,
        choice: evaluation.choice,
      });
      const persisted = await persistCultivationOutcome(profile, outcome, {});

      if (reason === 'time') {
        await interaction.editReply({
          embeds: [
            createCultivateResultEmbed(
              persisted.profile,
              {
                ...outcome,
                performance: evaluation.performance,
                minigame: challenge.minigame,
              },
              {
                title: 'Cultivation Timed Out',
                description:
                  'You hesitated too long, but the cultivation still settled a little.',
              },
            ),
          ],
          components: [],
        });
      }
    });
  },
};
