const {
  SlashCommandBuilder,
  EmbedBuilder,
  BaseInteraction,
} = require('discord.js');
const economy = require('../../modules/economy');
const {convertToSeconds} = require('../../utils/calculate');

module.exports = {
  cooldown: convertToSeconds('1s'),

  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw cash from your bank.')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount to withdraw')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const amount = interaction.options.getInteger('amount');
    const data = await economy.withdraw(
      interaction.user.id,
      interaction.guildId,
      amount
    );
    data.username = interaction.user.displayName;
    interaction.editReply({embeds: [responseEmbed(data)]});
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
    .setTitle(`💰 Withdrawl Statement for ${data.username}`)
    .setColor('#a8dadc')
    .setThumbnail(
      'https://cdn.discordapp.com/icons/1144324605599830086/75b1d6fd9acf20c5f0023001ad5d3ad7.webp?size=100'
    )
    .setDescription(`Your withdrawl of $${data.amount} is completed.`)
    .addFields(
      {name: '💵 Cash', value: `$${data.cash.toLocaleString()}`},
      {name: '🏦 Bank', value: `$${data.bank.toLocaleString()}`}
    )
    .setTimestamp()
    .setFooter({text: 'Yue Bank Corp.'});

  return embed;
}
