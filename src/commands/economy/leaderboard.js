const { SlashCommandBuilder } = require('discord.js');
const getCashLeaderboard = require('../../modules/economy/leaderboards/cashLeaderboard');
const getBankLeaderboard = require('../../modules/economy/leaderboards/bankLeaderboard');
const getNetWorthLeaderboard = require('../../modules/economy/leaderboards/netWorthLeaderboard');
const getDebtLeaderboard = require('../../modules/economy/leaderboards/debtLeaderboard');
const { createStatusEmbed } = require('../../utils/economyFeedback');
const { deferGuildInteraction } = require('../../utils/interactionHelpers');

const LEADERBOARD_CONFIG = {
  cash: {
    title: '💵 Cash Leaderboard',
    load: getCashLeaderboard,
    valueKey: 'cash',
  },
  bank: {
    title: '🏦 Bank Leaderboard',
    load: getBankLeaderboard,
    valueKey: 'bank',
  },
  networth: {
    title: '💰 Net Worth Leaderboard',
    load: getNetWorthLeaderboard,
    valueKey: 'netWorth',
  },
  debt: {
    title: '💳 Debt Leaderboard',
    load: getDebtLeaderboard,
    valueKey: 'debt',
  },
};

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

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Leaderboards can only be viewed inside a server.',
        defer: true,
      }))
    ) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const leaderboardConfig = LEADERBOARD_CONFIG[subcommand];
    const title = leaderboardConfig?.title ?? 'Leaderboard';
    const endQuery = commandMetrics?.step('leaderboard query');
    const leaderboardData = leaderboardConfig
      ? await leaderboardConfig.load(interaction.guildId)
      : [];
    endQuery?.();
    const guild = interaction.guild;
    const endResolve = commandMetrics?.step('member resolution');
    const filteredEntries = await resolveLeaderboardEntries(
      guild,
      leaderboardData,
    );
    endResolve?.();

    if (filteredEntries.length === 0) {
      const endRender = commandMetrics?.step('response build');
      const embed = createStatusEmbed({
        title,
        description:
          'No active members are currently eligible for this leaderboard.',
        color: '#FF8C00',
      });
      endRender?.();
      return interaction.editReply({ embeds: [embed] });
    }

    const fields = filteredEntries.map((user, index) => {
      const value = leaderboardConfig?.valueKey
        ? user[leaderboardConfig.valueKey]
        : undefined;

      return {
        name: `${index + 1}. ${user.displayName}`,
        value:
          value !== undefined && value !== null
            ? `\`$${value.toLocaleString()}\``
            : 'No data available',
        inline: false,
      };
    });

    const endRender = commandMetrics?.step('response build');
    const embed = createStatusEmbed({
      title,
      fields,
    });
    endRender?.();

    return interaction.editReply({ embeds: [embed] });
  },
};

async function resolveLeaderboardEntries(guild, leaderboardData) {
  if (!guild) {
    return [];
  }

  const uniqueUserIds = [
    ...new Set(leaderboardData.map((entry) => entry.userId)),
  ];
  const displayNames = new Map();

  for (const userId of uniqueUserIds) {
    const member = guild.members.cache?.get(userId);
    if (member) {
      displayNames.set(userId, member.displayName);
    }
  }

  const missingUserIds = uniqueUserIds.filter(
    (userId) => !displayNames.has(userId),
  );
  if (missingUserIds.length > 0) {
    const fetchedMembers = await guild.members
      .fetch({ user: missingUserIds })
      .catch(() => null);

    if (fetchedMembers) {
      for (const [userId, member] of fetchedMembers) {
        displayNames.set(userId, member.displayName);
      }
    }
  }

  return leaderboardData.flatMap((entry) => {
    const displayName = displayNames.get(entry.userId);
    if (!displayName) {
      return [];
    }

    return [{ ...entry, displayName }];
  });
}
