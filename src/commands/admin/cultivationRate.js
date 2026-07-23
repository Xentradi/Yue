const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const {
  clearCultivationEarnRateMultiplierForDiscordUserId,
  getCultivationStatusForDiscordUserId,
  setCultivationEarnRateMultiplierForDiscordUserId,
} = require('../../modules/cultivation/flowService');
const {
  createConfirmationEmbed,
  createStatusEmbed,
} = require('../../utils/economyFeedback');
const {
  deferGuildInteraction,
  getOptionInteger,
  getOptionUser,
} = require('../../utils/interactionHelpers');
const { canUseAdminCommands } = require('../../utils/adminPermissions');
const { promptForConfirmation } = require('../../utils/confirmationFlow');

const ALLOWED_MULTIPLIERS = new Set([2, 3, 6, 12]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cultivation-rate')
    .setDescription('Manage cultivation earn-rate buffs.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('get')
        .setDescription('Inspect a cultivation earn-rate buff for a user.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Target user')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set a cultivation earn-rate buff for a user.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Target user')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('multiplier')
            .setDescription('Earn-rate multiplier')
            .setRequired(true)
            .addChoices(
              { name: '2x', value: 2 },
              { name: '3x', value: 3 },
              { name: '6x', value: 6 },
              { name: '12x', value: 12 },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clear')
        .setDescription('Clear a cultivation earn-rate buff from a user.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Target user')
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction) {
    if (
      !(await deferGuildInteraction(interaction, {
        description:
          'You need administrator permissions to execute this command.',
        title: '❌ Permission Denied',
        defer: true,
        deferOptions: { flags: MessageFlags.Ephemeral },
      }))
    ) {
      return;
    }

    if (!canUseAdminCommands(interaction)) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = getOptionUser(interaction, 'user', 'target_user');
    const targetProfile = await getCultivationStatusForDiscordUserId(
      targetUser.id,
    );

    if (!targetProfile) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Cultivator Not Found',
        description: `${targetUser.username ?? targetUser.tag ?? 'That user'} does not have a cultivator yet.`,
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }

    if (subcommand === 'get') {
      const currentMultiplier =
        targetProfile.cultivation?.earnRateMultiplier ?? 1;
      const responseEmbed = createStatusEmbed({
        title: '🔎 Cultivation Buff',
        description: `${targetUser.username ?? targetUser.tag ?? 'That user'} currently has a ${currentMultiplier}x cultivation earn rate.`,
        color: '#7db6ff',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }

    if (subcommand === 'set') {
      const multiplier = getOptionInteger(
        interaction,
        'multiplier',
        'earn_rate_multiplier',
      );
      if (!ALLOWED_MULTIPLIERS.has(multiplier)) {
        const responseEmbed = createStatusEmbed({
          title: '❌ Invalid Multiplier',
          description: 'Choose 2x, 3x, 6x, or 12x.',
          color: '#FF0000',
        });
        return interaction.editReply({
          embeds: [responseEmbed],
          components: [],
        });
      }

      const previewEmbed = createConfirmationEmbed({
        title: '⚠️ Apply Cultivation Buff?',
        description: `${targetUser.username ?? targetUser.tag ?? 'That user'} will receive a ${multiplier}x cultivation earn-rate buff.`,
        fields: [
          {
            name: 'Target User',
            value: `${targetUser.username ?? targetUser.tag ?? 'Unknown user'}`,
            inline: true,
          },
          {
            name: 'Multiplier',
            value: `${multiplier}x`,
            inline: true,
          },
        ],
      });

      const confirmed = await promptForConfirmation(interaction, previewEmbed);
      if (!confirmed) {
        return;
      }

      const updatedProfile =
        await setCultivationEarnRateMultiplierForDiscordUserId(
          targetUser.id,
          multiplier,
        );

      if (!updatedProfile) {
        const responseEmbed = createStatusEmbed({
          title: '❌ Cultivation Buff Failed',
          description: 'The buff could not be applied.',
          color: '#FF0000',
        });
        return interaction.editReply({
          embeds: [responseEmbed],
          components: [],
        });
      }

      const responseEmbed = createStatusEmbed({
        title: '✅ Cultivation Buff Applied',
        description: `${targetUser.username ?? targetUser.tag ?? 'That user'} now has a ${multiplier}x cultivation earn rate.`,
        color: '#33CC33',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }

    const previewEmbed = createConfirmationEmbed({
      title: '⚠️ Clear Cultivation Buff?',
      description: `${targetUser.username ?? targetUser.tag ?? 'That user'} will return to the normal 1x cultivation earn rate.`,
      fields: [
        {
          name: 'Target User',
          value: `${targetUser.username ?? targetUser.tag ?? 'Unknown user'}`,
          inline: true,
        },
        {
          name: 'Multiplier',
          value: `${targetProfile.cultivation?.earnRateMultiplier ?? 1}x -> 1x`,
          inline: true,
        },
      ],
    });

    const confirmed = await promptForConfirmation(interaction, previewEmbed);
    if (!confirmed) {
      return;
    }

    const updatedProfile =
      await clearCultivationEarnRateMultiplierForDiscordUserId(targetUser.id);

    if (!updatedProfile) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Cultivation Buff Failed',
        description: 'The buff could not be cleared.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }

    const responseEmbed = createStatusEmbed({
      title: '✅ Cultivation Buff Cleared',
      description: `${targetUser.username ?? targetUser.tag ?? 'That user'} now has the normal 1x cultivation earn rate.`,
      color: '#33CC33',
    });
    return interaction.editReply({ embeds: [responseEmbed], components: [] });
  },
};
