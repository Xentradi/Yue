const {
  SlashCommandBuilder,
  EmbedBuilder,
  BaseInteraction,
} = require('discord.js');
const economy = require('../../modules/economy');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Shows your balance.'),
  /**
   * @param {BaseInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();
    const data = await economy.getBalance(
      interaction.user.id,
      interaction.guildId
    );
    data.username = interaction.user.displayName;
    const balanceEmbed = createBalanceEmbed(data);
    interaction.editReply({embeds: [balanceEmbed]});
  },
};

/**
 * Create a balance embed for a user
 *
 * @param {Object} balance - The user's balance.
 * @returns {MessageEmbed} - The embed to send.
 */
function createBalanceEmbed(balance) {
  const embed = new EmbedBuilder()
    .setTitle(`💰 Financial Statement for ${balance.username}`)
    .setColor('#a8dadc')
    .setThumbnail(
      'https://cdn.discordapp.com/icons/1144324605599830086/75b1d6fd9acf20c5f0023001ad5d3ad7.webp?size=100'
    )
    .addFields(
      {name: '💵 Cash', value: `$${balance.cash.toLocaleString()}`},
      {name: '🏦 Bank', value: `$${balance.bank.toLocaleString()}`},
      {name: '📉 Debt', value: `$${balance.debt.toLocaleString()}`}
    )
    .setTimestamp()
    .setFooter({text: 'Yue Bank Corp.'});

  return embed;
}
