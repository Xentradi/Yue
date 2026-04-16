const { SlashCommandBuilder } = require('discord.js');
const dailyBonus = require('../../modules/economy/bonuses/dailyBonus');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward.'),
  cooldown: '1s',
  deployGlobal: true,

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Daily rewards can only be claimed inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
    }

    await interaction.deferReply();
    const data = await dailyBonus(interaction.user.id, interaction.guildId);

    if (data.success) {
      const responseEmbed = createBalanceEmbed({
        title: `💰 Daily Reward for ${interaction.member.displayName}`,
        description: `Your daily reward of ${formatCurrency(data.amount)} has been delivered. Come back <t:${Math.floor(data.nextClaimAt.getTime() / 1000)}:R>.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const responseEmbed = createStatusEmbed({
      title: '⚠️ Daily Pay Unavailable',
      description:
        data.message === 'Daily bonus already claimed today.'
          ? `You already claimed today's reward. Come back <t:${Math.floor(data.nextClaimAt.getTime() / 1000)}:R>.`
          : data.message || 'There was an error delivering your pay.',
      color: '#FF8C00',
    });
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
