const { SlashCommandBuilder } = require('discord.js');
const deposit = require('../../modules/economy/bankOperations/deposit');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');

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

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Deposits can only be made inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
    }

    await interaction.deferReply();
    const amount = interaction.options.getInteger('amount');
    const data = await deposit(
      interaction.user.id,
      interaction.guildId,
      amount,
    );

    if (data.success) {
      const responseEmbed = createBalanceEmbed({
        title: `🏦 Deposit Completed for ${interaction.member.displayName}`,
        description: `Deposited ${formatCurrency(data.amount)} into your bank.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const responseEmbed = createStatusEmbed({
      title: '⚠️ Deposit Failed',
      description: data.message || 'We could not complete the deposit request.',
      color: '#FF3333',
    });
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
