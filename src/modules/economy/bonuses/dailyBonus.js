const Player = require('../../../models/Player');
const config = require('../../../config.json');
const balance = require('../../economy/balance');
const logger = require('../../../utils/logger');

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
  const player = await Player.findOne({userId, guildId});

  if (!player) {
    return {
      success: false,
      message: 'Player not found.',
    };
  }

  const bonusAmount = config.dailyWage ?? 500; // Default to 500 if dailyWage isn't set in the config

  try {
    const updateCashResult = await balance.updatePlayerCash(
      player,
      bonusAmount
    );

    return updateCashResult.success
      ? {
          success: true,
          amount: bonusAmount,
          cash: updateCashResult.cash,
        }
      : updateCashResult;
  } catch (err) {
    logger.error(`An error occurred while granting the daily bonus: ${err}`);
    return {
      success: false,
      message: 'An error occurred while granting the daily bonus.',
    };
  }
};
