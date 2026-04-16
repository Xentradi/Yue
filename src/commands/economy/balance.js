const { SlashCommandBuilder } = require('discord.js');
const getBalance = require('../../modules/economy/playerInfo/balance');
const {
  createBalanceEmbed,
  createStatusEmbed,
} = require('../../utils/economyFeedback');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('View your balance.'),
  cooldown: 2,
  deployGlobal: true,

  /**
   * Executes the balance command which shows the user's current balance.
   *
   * @async
   * @function
   * @param {import('discord.js').BaseInteraction} interaction - The interaction that triggered the command.
   * @throws Will send an error response to the user if there's an issue retrieving the balance.
   */
  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Balance checks can only be viewed inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
    }

    await interaction.deferReply();

    const playerBalance = await getBalance(
      interaction.user.id,
      interaction.guildId,
    );
    logger.debug(`playerBalance: ${playerBalance}`);
    if (!playerBalance.success) {
      const responseEmbed = createStatusEmbed({
        title: '💰 Balance Unavailable',
        description: playerBalance.message,
        color: '#FF3333',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const responseEmbed = createBalanceEmbed({
      title: `💰 Financial Statement for ${interaction.member.displayName}`,
      cash: playerBalance.cash,
      bank: playerBalance.bank,
      debt: playerBalance.debt,
    });
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
