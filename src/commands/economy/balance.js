const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const getBalance = require('../../modules/economy/playerInfo/balance');
const {createEmbed} = require('../../utils/embedUtils');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Shows your balance.'),
  cooldown: 2,
  deployGlobal: true,

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

    const playerBalance = await getBalance(
      interaction.user.id,
      interaction.guildId
    );
    logger.debug(`playerBalance: ${playerBalance}`);
    if (!playerBalance.success) {
      return interaction.editReply(playerBalance.message);
    }

    const embedOptions = {
      title: `💰 Financial Statement for ${interaction.member.displayName}`,
      fields: [
        {name: '💵 Cash', value: `$${playerBalance.cash.toLocaleString()}`},
        {name: '🏦 Bank', value: `$${playerBalance.bank.toLocaleString()}`},
        {name: '📉 Debt', value: `$${playerBalance.debt.toLocaleString()}`},
      ],
    };
    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
