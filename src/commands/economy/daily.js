const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const dailyBonus = require('../../modules/economy/bonuses/dailyBonus');
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  cooldown: convertToSeconds('1d'),
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward.'),
  /**
   * @param {BaseInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();
    const data = await dailyBonus(interaction.user.id, interaction.guildId);
    data.username = interaction.user.displayName;
    const embedOptions = {
      title: `💰 ${data.username} Pay Stub`,
      description: `Your daily pay of $${data.amount} has been delivered.`,
    };
    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};