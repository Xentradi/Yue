const {
  SlashCommandBuilder,
  EmbedBuilder,
  BaseInteraction,
} = require('discord.js');
const economy = require('../../modules/economy');
const {convertToSeconds} = require('../../utils/calculate');

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
    const data = await economy.dailyBonus(
      interaction.user.id,
      interaction.guildId
    );
    data.username = interaction.user.displayName;
    const balanceEmbed = responseEmbed(data);
    interaction.editReply({embeds: [balanceEmbed]});
  },
};

/**
 * Create a embed for the output
 *
 * @param {Object} data - The user's account data.
 * @returns {MessageEmbed} - The embed to send.
 */
function responseEmbed(data) {
  const embed = new EmbedBuilder()
    .setTitle(`💰 ${data.username} Pay Stub`)
    .setColor('#a8dadc')
    .setThumbnail(
      'https://cdn.discordapp.com/icons/1144324605599830086/75b1d6fd9acf20c5f0023001ad5d3ad7.webp?size=100'
    )
    .setDescription(`Your daily pay of $${data.amount} has been delivered.`)
    .setTimestamp()
    .setFooter({text: 'Yue Bank Corp.'});

  return embed;
}
