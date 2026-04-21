const config = require('../../../config.json');
const logger = require('../../../utils/logger');
const {
  ensurePlayer,
  findPlayer,
  updatePlayerValues,
} = require('../playerService');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

/**
 * Provides a daily cash bonus to a player.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @returns {Promise<Object>} An object containing the transaction result.
 * @throws Will log an error if there's an issue with database access.
 */

module.exports = async function dailyBonus(userId, guildId) {
  const now = new Date();
  const claimStart = new Date(now);
  claimStart.setHours(0, 0, 0, 0);
  const nextClaimAt = new Date(claimStart.getTime() + 24 * 60 * 60 * 1000);

  const bonusAmount = config.dailyWage ?? 500; // Default to 500 if dailyWage isn't set in the config

  try {
    const result = await withTransaction(async (client) => {
      await ensurePlayer(userId, guildId, { client });
      const player = await findPlayer(userId, guildId, { client, lock: true });

      if (!player) {
        return {
          success: false,
          message: 'An error occurred while granting the daily bonus.',
        };
      }

      const currentCash = Number.isFinite(player.cash) ? player.cash : 0;
      if (
        player.cash !== undefined &&
        player.cash !== null &&
        player.cash < 0
      ) {
        return {
          success: false,
          message: 'Player cash balance is invalid.',
        };
      }

      const today = claimStart.getTime();
      const lastClaimDate = player.lastDailyBonusClaim
        ? new Date(player.lastDailyBonusClaim).setHours(0, 0, 0, 0)
        : null;

      if (lastClaimDate === today) {
        return {
          success: false,
          message: 'Daily bonus already claimed today.',
        };
      }

      const nextCash = currentCash + bonusAmount;
      const updateResult = await updatePlayerValues(
        player,
        {
          cash: nextCash,
          lastDailyBonusClaim: new Date(today),
        },
        { client },
      );

      if (!updateResult.success) {
        return {
          success: false,
          message: updateResult.error,
        };
      }

      return {
        success: true,
        amount: bonusAmount,
        cash: nextCash,
      };
    });

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        nextClaimAt,
      };
    }

    await Promise.all([
      bumpVersion('player', guildId),
      bumpVersion('leaderboard', guildId),
    ]);

    return {
      success: true,
      amount: bonusAmount,
      cash: result.cash,
      nextClaimAt,
    };
  } catch (err) {
    logger.error(`An error occurred while granting the daily bonus: ${err}`);
    return {
      success: false,
      message: 'An error occurred while granting the daily bonus.',
      nextClaimAt,
    };
  }
};
