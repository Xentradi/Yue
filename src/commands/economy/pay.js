const { SlashCommandBuilder } = require('discord.js');
const giveCash = require('../../modules/economy/transfers/giveCash');
const {
  createBalanceEmbed,
  createStatusEmbed,
  getDisplayName,
  formatCurrency,
} = require('../../utils/economyFeedback');
const {
  deferGuildInteraction,
  getOptionInteger,
  getOptionUser,
} = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Send cash to another member.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member to receive the cash')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to send')
        .setRequired(true),
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Payments can only be sent inside a server.',
        defer: true,
      }))
    ) {
      return;
    }

    const recipient = getOptionUser(interaction, 'user', 'target_user');
    const amount = getOptionInteger(interaction, 'amount', 'cash_amount');

    if (!recipient) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '❌ Transfer Failed',
        description:
          'No recipient was provided. Re-run the command with `user` set to the target member.',
        color: '#FF3333',
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '❌ Transfer Failed',
        description: 'Please provide a positive integer amount to send.',
        color: '#FF3333',
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endUpdate = commandMetrics?.step('transfer');
    const data = await giveCash(
      interaction.user.id,
      recipient.id,
      interaction.guildId,
      amount,
    );
    endUpdate?.();
    const recipientName = getDisplayName(interaction, recipient);
    const senderName = interaction.member.displayName;

    if (data.success) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createBalanceEmbed({
        title: '💸 Transfer Completed',
        description: `${senderName} sent ${formatCurrency(data.transferredAmount)} to ${recipientName}.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title: '❌ Transfer Failed',
      description:
        data.message || 'We could not complete the transfer request.',
      color: '#FF3333',
    });
    endRender?.();
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
