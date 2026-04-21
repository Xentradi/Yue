const { SlashCommandBuilder } = require('discord.js');
const bankService = require('../../modules/economy/bankService');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');
const {
  deferGuildInteraction,
  getOptionInteger,
} = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Move cash from your bank to your wallet.')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to withdraw')
        .setRequired(true),
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Withdrawals can only be made inside a server.',
        defer: true,
      }))
    ) {
      return;
    }
    const amount = getOptionInteger(interaction, 'amount', 'cash_amount');

    if (!Number.isInteger(amount) || amount <= 0) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '⚠️ Withdrawal Failed',
        description: 'Please provide a positive integer amount to withdraw.',
        color: '#FF3333',
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endUpdate = commandMetrics?.step('withdraw');
    const data = await bankService.withdraw(
      interaction.user.id,
      interaction.guildId,
      amount,
    );
    endUpdate?.();

    if (data && data.success) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createBalanceEmbed({
        title: `🏦 Withdrawal Completed for ${interaction.member.displayName}`,
        description: `Withdrew ${formatCurrency(data.amount)} from your bank.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title: '⚠️ Withdrawal Failed',
      description:
        data?.message ?? 'We could not complete the withdrawal request.',
      color: '#FF3333',
    });
    endRender?.();
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
