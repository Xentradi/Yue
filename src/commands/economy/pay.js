const { SlashCommandBuilder } = require('discord.js');
const giveCash = require('../../modules/economy/transfers/giveCash');
const {
  createBalanceEmbed,
  createStatusEmbed,
  getDisplayName,
  formatCurrency,
} = require('../../utils/economyFeedback');
const { deferGuildInteraction } = require('../../utils/interactionHelpers');

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
      }))
    ) {
      return;
    }

    const recipient = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
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
      return interaction.reply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title: '❌ Transfer Failed',
      description:
        data.message || 'We could not complete the transfer request.',
      color: '#FF3333',
    });
    endRender?.();
    return interaction.reply({ embeds: [responseEmbed] });
  },
};
