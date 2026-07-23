const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { listBackgroundDefinitions } = require('../../storage/cultivationRepository');
const {
  getCultivationStatusForDiscordUserId,
} = require('../../modules/cultivation/flowService');
const {
  createOnboardingEmbed,
  createProfileEmbed,
} = require('../../modules/cultivation/flowPresentation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your cultivation profile.'),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction) {
    const profile = await getCultivationStatusForDiscordUserId(interaction.user.id);

    if (!profile) {
      const backgrounds = await listBackgroundDefinitions();
      const embed = createOnboardingEmbed(backgrounds);
      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = createProfileEmbed(profile);
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
