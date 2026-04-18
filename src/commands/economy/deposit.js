const { SlashCommandBuilder } = require('discord.js');
const deposit = require('../../modules/economy/bankOperations/deposit');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');
const { deferGuildInteraction } = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Move cash from your wallet to your bank.')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to deposit')
        .setRequired(true),
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Deposits can only be made inside a server.',
      }))
    ) {
      return;
    }
    const amount = interaction.options.getInteger('amount');
    const endUpdate = commandMetrics?.step('deposit');
    const data = await deposit(
      interaction.user.id,
      interaction.guildId,
      amount,
    );
    endUpdate?.();

    if (data.success) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createBalanceEmbed({
        title: `🏦 Deposit Completed for ${interaction.member.displayName}`,
        description: `Deposited ${formatCurrency(data.amount)} into your bank.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      endRender?.();
      return interaction.reply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title: '⚠️ Deposit Failed',
      description: data.message || 'We could not complete the deposit request.',
      color: '#FF3333',
    });
    endRender?.();
    return interaction.reply({ embeds: [responseEmbed] });
  },
};
