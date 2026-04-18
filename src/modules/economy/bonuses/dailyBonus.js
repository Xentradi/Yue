const config = require('../../../config.json');
const logger = require('../../../utils/logger');
const { findPlayer, updatePlayerValues } = require('../playerService');

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
  const player = await findPlayer(userId, guildId);
  const now = new Date();
  const claimStart = new Date(now);
  claimStart.setHours(0, 0, 0, 0);
  const nextClaimAt = new Date(claimStart.getTime() + 24 * 60 * 60 * 1000);

  if (!player) {
    return {
      success: false,
      message: 'Player not found.',
      nextClaimAt,
    };
  }

  if (!Number.isFinite(player.cash) || player.cash < 0) {
    return {
      success: false,
      message: 'Player cash balance is invalid.',
      nextClaimAt,
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
      nextClaimAt,
    };
  }

  const bonusAmount = config.dailyWage ?? 500; // Default to 500 if dailyWage isn't set in the config

  try {
    const nextCash = player.cash + bonusAmount;
    const updateResult = await updatePlayerValues(player, {
      cash: nextCash,
      lastDailyBonusClaim: new Date(today),
    });

    if (!updateResult.success) {
      return {
        success: false,
        message: updateResult.error,
        nextClaimAt,
      };
    }

    return {
      success: true,
      amount: bonusAmount,
      cash: nextCash,
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
