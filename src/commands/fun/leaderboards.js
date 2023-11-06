const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const getCashLeaderboard = require('../../modules/economy/leaderboards/cashLeaderboard');
const getBankLeaderboard = require('../../modules/economy/leaderboards/bankLeaderboard');
const getNetWorthLeaderboard = require('../../modules/economy/leaderboards/netWorthLeaderboard');
const getDebtLeaderboard = require('../../modules/economy/leaderboards/debtLeaderboard');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View various leaderboards')
    .addSubcommand(subcommand =>
      subcommand.setName('cash').setDescription('View the cash leaderboard')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('bank').setDescription('View the bank leaderboard')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('networth')
        .setDescription('View the net worth leaderboard')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('debt').setDescription('View the debt leaderboard')
    ),
  cooldown: 2,
  deployGlobal: true,

  /**
   *
   * @param {BaseInteraction} interaction
   */

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    let leaderboardData, emoji, title;
    switch (subcommand) {
      case 'cash':
        leaderboardData = await getCashLeaderboard(interaction.guildId);
        emoji = ':military_medal: ';
        title = '💵 Cash Leaderboard';
        break;
      case 'bank':
        leaderboardData = await getBankLeaderboard(interaction.guildId);
        emoji = ':military_medal: ';
        title = '🏦 Bank Leaderboard';
        break;
      case 'networth':
        leaderboardData = await getNetWorthLeaderboard(interaction.guildId);
        emoji = ':military_medal: ';
        title = '💰 Net Worth Leaderboard';
        break;
      case 'debt':
        leaderboardData = await getDebtLeaderboard(interaction.guildId);
        emoji = ':military_medal: ';
        title = '💳 Debt Leaderboard';
        break;
      // ... (Handle other cases like level and debt here, and assign appropriate emojis and titles)
    }
    const fields = await Promise.all(
      leaderboardData.map(async (user, index) => {
        const displayName = await getDisplayName(
          user.userId,
          interaction.guildId,
          interaction.client
        );

        let value;
        switch (subcommand) {
          case 'cash':
            value = user.cash;
            break;
          case 'bank':
            value = user.bank;
            break;
          case 'networth':
            value = user.netWorth;
            break;
          case 'debt':
            value = user.debt;
            break;
          // ... (Handle other cases like level and debt here)
        }

        return {
          name: `${index + 1}. ${displayName}`,
          value:
            value !== undefined && value !== null
              ? ` \`$${value.toLocaleString()}\``
              : 'No data available',
          inline: false,
        };
      })
    );

    const embed = createEmbed({
      title,
      fields,
    });

    await interaction.reply({embeds: [embed]});
  },
};

async function getDisplayName(userId, guildId, client) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId);
  return member.displayName;
}
