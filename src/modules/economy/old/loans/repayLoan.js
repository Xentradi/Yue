const Player = require('../../../models/Player');
const logger = require('../../../utils/logger');

/**
 * Allows a player to repay a portion or the entirety of their debt.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user attempting to repay the loan.
 * @param {string} guildId - The ID of the guild (server) where the user is a member.
 * @param {number} amount - The amount the player wishes to repay.
 * @returns {Promise<Object>} An object containing the outcome of the repayment.
 * @throws Will log an error if saving to the database fails.
 */
module.exports = async function repayLoan(userId, guildId, amount) {
  const player = await Player.findOne({userId, guildId});

  if (!player) {
    return {
      success: false,
      message: 'Player not found.',
    };
  }

  if (amount <= 0) {
    return {
      success: false,
      message: 'Invalid repayment amount.',
    };
  }

  if (player.cash < amount) {
    return {
      success: false,
      message: 'Insufficient funds to repay the loan.',
    };
  }

  player.debt -= amount;
  player.cash -= amount;

  player.debt = Math.max(player.debt, 0);
  player.cash = Math.max(player.cash, 0);

  if (player.debt < 0) {
    player.cash += Math.abs(player.debt); // If they overpay, return the extra to cash
    player.debt = 0;
  }

  try {
    await player.save();
  } catch (err) {
    logger.error(`Failed to save changes to database: ${err}`);
    return {
      success: false,
      message: 'Failed to save changes to the database.',
    };
  }

  return {
    success: true,
    repaidAmount: amount,
    remainingDebt: player.debt,
    newBalance: player.cash,
  };
};
