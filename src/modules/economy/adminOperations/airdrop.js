const { ensurePlayers } = require('../playerService');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

module.exports = async function airdrop(interaction) {
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;
  const channelMembers = interaction.channel?.members;

  if (!Number.isInteger(amount) || amount <= 0) {
    return { success: false, error: 'Amount must be a positive integer.' };
  }

  if (!channelMembers || typeof channelMembers.values !== 'function') {
    return {
      success: false,
      error:
        'Airdrop can only be used in a channel with visible active members.',
    };
  }

  try {
    const result = await withTransaction(async (client) => {
      const activeUserIds = [
        ...new Set(
          [...channelMembers.values()]
            .filter((member) => !member.user.bot)
            .map((member) => member.user.id),
        ),
      ];

      if (activeUserIds.length === 0) {
        return {
          success: false,
          error: 'No active members were found in the current channel.',
        };
      }

      await ensurePlayers(
        activeUserIds.map((userId) => ({ guildId, userId })),
        { client },
      );

      const updateResult = await client.query(
        `
          UPDATE players
          SET cash = cash + $1,
              updated_at = NOW()
          WHERE guild_id = $2
            AND user_id = ANY($3::text[])
            AND cash >= 0
          RETURNING user_id;
        `,
        [amount, guildId, activeUserIds],
      );

      const recipientCount = updateResult.rowCount ?? 0;
      const skippedCount = activeUserIds.length - recipientCount;

      return {
        success: true,
        amount,
        total: recipientCount * amount,
        recipientCount,
        skippedCount,
      };
    });

    if (result.success) {
      await Promise.all([
        bumpVersion('player', guildId),
        bumpVersion('leaderboard', guildId),
        bumpVersion('tracked'),
      ]);
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};
