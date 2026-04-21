const {
  ensurePlayer,
  findPlayer,
  updatePlayerValues,
} = require('../playerService');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

module.exports = async function resetBalance(interaction) {
  const user = interaction.options.getUser('user');
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const userId = user.id;
  const guildId = interaction.guildId;

  try {
    const result = await withTransaction(async (client) => {
      await ensurePlayer(userId, guildId, { client });
      const player = await findPlayer(userId, guildId, { client, lock: true });

      const updateResult = await updatePlayerValues(
        player,
        {
          cash: 0,
          bank: 0,
          debt: 0,
        },
        { client },
      );
      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      return {
        success: true,
        userId,
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
