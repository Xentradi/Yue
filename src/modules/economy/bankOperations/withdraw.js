const Player = require('../../../models/Player');
const balance = require('../../economy/balance');
const logger = require('../../../utils/logger');

/**
 * Withdraws a specified amount of cash from a player's bank account.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @param {number} amount - The amount of cash to withdraw.
 * @returns {Promise<Object>} An object containing the transaction result.
 * @throws Will log an error if there's an issue with database access.
 */
module.exports = async function withdraw(userId, guildId, amount) {
  const player = await Player.findOne({ userId, guildId });

  if (!player) {
    return {
      success: false,
      message: 'User not found.',
    };
  }

  if (amount <= 0) {
    return {
      success: false,
      message: 'Invalid amount.',
    };
  }

  if (player.bank < amount) {
    return {
      success: false,
      message: 'Insufficient bank funds.',
    };
  }

  try {
    const transferResult = await balance.transferFunds(player, amount, false);
    return transferResult.success
      ? {
          success: true,
          amount: amount,
          cash: transferResult.cash,
          bank: transferResult.bank,
          debt: player.debt,
        }
      : transferResult;
  } catch (error) {
    logger.error(`An error occured while processing the withdrawl: ${error}`);
    return {
      success: false,
      message: 'An error occurred while processing the withdrawl.',
    };
  }
};
