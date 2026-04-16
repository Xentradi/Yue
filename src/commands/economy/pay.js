const { SlashCommandBuilder } = require('discord.js');
const giveCash = require('../../modules/economy/tranfers/giveCash');
const {
  createBalanceEmbed,
  createStatusEmbed,
  getDisplayName,
  formatCurrency,
} = require('../../utils/economyFeedback');

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

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Payments can only be sent inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
    }

    await interaction.deferReply();

    const recipient = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const data = await giveCash(
      interaction.user.id,
      recipient.id,
      interaction.guildId,
      amount,
    );
    const recipientName = getDisplayName(interaction, recipient);
    const senderName = interaction.member.displayName;

    if (data.success) {
      const responseEmbed = createBalanceEmbed({
        title: '💸 Transfer Completed',
        description: `${senderName} sent ${formatCurrency(data.transferredAmount)} to ${recipientName}.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const responseEmbed = createStatusEmbed({
      title: '❌ Transfer Failed',
      description:
        data.message || 'We could not complete the transfer request.',
      color: '#FF3333',
    });
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
