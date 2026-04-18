const { SlashCommandBuilder } = require('discord.js');
const dailyBonus = require('../../modules/economy/bonuses/dailyBonus');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');
const { deferGuildInteraction } = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward.'),
  cooldown: '1s',
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Daily rewards can only be claimed inside a server.',
      }))
    ) {
      return;
    }
    const endLookup = commandMetrics?.step('daily reward');
    const data = await dailyBonus(interaction.user.id, interaction.guildId);
    endLookup?.();

    if (data.success) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createBalanceEmbed({
        title: `💰 Daily Reward for ${interaction.member.displayName}`,
        description: `Your daily reward of ${formatCurrency(data.amount)} has been delivered. Come back <t:${Math.floor(data.nextClaimAt.getTime() / 1000)}:R>.`,
        cash: data.cash,
        bank: data.bank,
        debt: data.debt,
      });
      endRender?.();
      return interaction.reply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title: '⚠️ Daily Pay Unavailable',
      description:
        data.message === 'Daily bonus already claimed today.'
          ? `You already claimed today's reward. Come back <t:${Math.floor(data.nextClaimAt.getTime() / 1000)}:R>.`
          : data.message || 'There was an error delivering your pay.',
      color: '#FF8C00',
    });
    endRender?.();
    return interaction.reply({ embeds: [responseEmbed] });
  },
};
