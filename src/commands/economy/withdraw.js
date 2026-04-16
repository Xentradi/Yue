const { SlashCommandBuilder } = require('discord.js');
const withdraw = require('../../modules/economy/bankOperations/withdraw');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');

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

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Withdrawals can only be made inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
    }

    await interaction.deferReply();
    const amount = interaction.options.getInteger('amount');
    const data = await withdraw(
      interaction.user.id,
      interaction.guildId,
      amount,
    );

    if (data && data.success) {
      const responseEmbed = createBalanceEmbed({
        title: `🏦 Withdrawal Completed for ${interaction.member.displayName}`,
        description: `Withdrew ${formatCurrency(data.amount)} from your bank.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const responseEmbed = createStatusEmbed({
      title: '⚠️ Withdrawal Failed',
      description:
        data?.message ?? 'We could not complete the withdrawal request.',
      color: '#FF3333',
    });
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
