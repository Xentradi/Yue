const balance = require('../../economy/balance');
const logger = require('../../../utils/logger');
const { findPlayer } = require('../playerService');

/**
 * Deposits a specified amount of cash into a player's bank account.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @param {number} amount - The amount of cash to deposit.
 * @returns {Promise<Object>} An object containing the transaction result and status of operation.
 * @throws Will log an error if saving to the database fails.
 */
module.exports = async function deposit(userId, guildId, amount) {
  const player = await findPlayer(userId, guildId);

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

  if (player.cash < amount) {
    return {
      success: false,
      message: 'Insufficient cash.',
    };
  }

  try {
    const transferResult = await balance.transferFunds(player, amount, true);
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
    logger.error(`An error occurred while processing the deposit: ${error}`);
    return {
      success: false,
      message: 'An error occurred while processing the deposit.',
    };
  }
};
