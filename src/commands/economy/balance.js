const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const getBalance = require('../../modules/economy/playerInfo/balance');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Shows your balance.'),

  /**
   * Executes the balance command which shows the user's current balance.
   *
   * @async
   * @function
   * @param {BaseInteraction} interaction - The interaction that triggered the command.
   * @throws Will send an error response to the user if there's an issue retrieving the balance.
   */
  async execute(interaction) {
    await interaction.deferReply();

    const data = await getBalance(interaction.user.id, interaction.guildId);

    if (!data.success) {
      return interaction.editReply(data.message);
    }

    const embedOptions = {
      title: `💰 Financial Statement for ${interaction.user.displayName}`,
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
