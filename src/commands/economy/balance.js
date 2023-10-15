const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const getBalance = require('../../modules/economy/playerInfo/balance');
const {createEmbed} = require('../../utils/embedUtils');

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
    const data = await getBalance(interaction.user.id, interaction.guildId);
    data.username = interaction.user.displayName;
    const embedOptions = {
      title: `💰 Financial Statement for ${data.username}`,
      fields: [
        {name: '💵 Cash', value: `$${data.cash.toLocaleString()}`},
        {name: '🏦 Bank', value: `$${data.bank.toLocaleString()}`},
        {name: '📉 Debt', value: `$${data.debt.toLocaleString()}`},
      ],
    };
    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
