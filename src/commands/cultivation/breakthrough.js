const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const {
  attemptBreakthroughForDiscordUserId,
  getCultivationStatusForDiscordUserId,
} = require('../../modules/cultivation/flowService');
const {
  createActionLockEmbed,
  createBreakthroughResultEmbed,
  createOnboardingEmbed,
} = require('../../modules/cultivation/flowPresentation');
const { listBackgroundDefinitions } = require('../../storage/cultivationRepository');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('breakthrough')
    .setDescription('Attempt an awakening or breakthrough.'),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    const currentProfile = await getCultivationStatusForDiscordUserId(interaction.user.id);
    if (!currentProfile) {
      const embed = createOnboardingEmbed(await listBackgroundDefinitions());
      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    const actionLabel =
      currentProfile.cultivation?.stage && currentProfile.cultivation.stage > 0
        ? 'Breakthrough'
        : 'Awakening';

    if (currentProfile.cultivation?.meditationStartedAt) {
      return interaction.reply({
        embeds: [
          createActionLockEmbed(
            `${actionLabel} Locked`,
            'Stop meditation before attempting an awakening or breakthrough.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const result = await attemptBreakthroughForDiscordUserId(interaction.user.id);
    if (!result) {
      const embed = createOnboardingEmbed(await listBackgroundDefinitions());
      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (result.locked) {
      return interaction.reply({
        embeds: [
          createActionLockEmbed(
            `${actionLabel} Locked`,
            result.message ?? 'Stop meditation before attempting an awakening or breakthrough.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = createBreakthroughResultEmbed(result.profile, result.outcome);
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
