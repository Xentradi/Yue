const { SlashCommandBuilder } = require('discord.js');
const getCashLeaderboard = require('../../modules/economy/leaderboards/cashLeaderboard');
const getBankLeaderboard = require('../../modules/economy/leaderboards/bankLeaderboard');
const getNetWorthLeaderboard = require('../../modules/economy/leaderboards/netWorthLeaderboard');
const getDebtLeaderboard = require('../../modules/economy/leaderboards/debtLeaderboard');
const { createStatusEmbed } = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View economy leaderboards.')
    .addSubcommand((subcommand) =>
      subcommand.setName('cash').setDescription('View the cash leaderboard.'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('bank').setDescription('View the bank leaderboard.'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('networth')
        .setDescription('View the net worth leaderboard.'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('debt').setDescription('View the debt leaderboard.'),
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const embed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Leaderboards can only be viewed inside a server.',
        color: '#FF0000',
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    let leaderboardData;
    let title;
    switch (subcommand) {
      case 'cash':
        leaderboardData = await getCashLeaderboard(interaction.guildId);
        title = '💵 Cash Leaderboard';
        break;
      case 'bank':
        leaderboardData = await getBankLeaderboard(interaction.guildId);
        title = '🏦 Bank Leaderboard';
        break;
      case 'networth':
        leaderboardData = await getNetWorthLeaderboard(interaction.guildId);
        title = '💰 Net Worth Leaderboard';
        break;
      case 'debt':
        leaderboardData = await getDebtLeaderboard(interaction.guildId);
        title = '💳 Debt Leaderboard';
        break;
      default:
        leaderboardData = [];
        title = 'Leaderboard';
    }

    const filteredEntries = [];
    for (const user of leaderboardData) {
      const displayName = await getDisplayName(
        user.userId,
        interaction.guildId,
        interaction.client,
      );

      if (!displayName) {
        continue;
      }

      filteredEntries.push({ ...user, displayName });
    }

    if (filteredEntries.length === 0) {
      const embed = createStatusEmbed({
        title,
        description:
          'No active members are currently eligible for this leaderboard.',
        color: '#FF8C00',
      });
      return interaction.reply({ embeds: [embed] });
    }

    const fields = filteredEntries.map((user, index) => {
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
        default:
          value = undefined;
      }

      return {
        name: `${index + 1}. ${user.displayName}`,
        value:
          value !== undefined && value !== null
            ? `\`$${value.toLocaleString()}\``
            : 'No data available',
        inline: false,
      };
    });

    const embed = createStatusEmbed({
      title,
      fields,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

async function getDisplayName(userId, guildId, client) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    return member.displayName;
  } catch {
    return null;
  }
}
