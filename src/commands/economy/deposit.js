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
        defer: true,
      }))
    ) {
      return;
    }
    const amount = getOptionInteger(interaction, 'amount', 'cash_amount');

    if (!Number.isInteger(amount) || amount <= 0) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '⚠️ Deposit Failed',
        description: 'Please provide a positive integer amount to deposit.',
        color: '#FF3333',
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endUpdate = commandMetrics?.step('deposit');
    const data = await bankService.deposit(
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
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title: '⚠️ Deposit Failed',
      description: data.message || 'We could not complete the deposit request.',
      color: '#FF3333',
    });
    endRender?.();
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
