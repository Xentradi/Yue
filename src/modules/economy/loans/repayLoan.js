const logger = require('../../../utils/logger');
const { findPlayer, updatePlayerValues } = require('../playerService');

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
  const player = await findPlayer(userId, guildId);

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

  if (
    !Number.isFinite(player.cash) ||
    player.cash < 0 ||
    !Number.isFinite(player.debt) ||
    player.debt < 0
  ) {
    return {
      success: false,
      message: 'Player balances are invalid.',
    };
  }

  if (player.debt <= 0) {
    return {
      success: false,
      message: 'No outstanding debt to repay.',
    };
  }

  const repaymentAmount = Math.min(amount, player.debt);

  if (player.cash < repaymentAmount) {
    return {
      success: false,
      message: 'Insufficient funds to repay the loan.',
    };
  }
  const refundAmount = amount - repaymentAmount;

  const updateResult = await updatePlayerValues(player, {
    debt: player.debt - repaymentAmount,
    cash: player.cash - repaymentAmount,
  });

  if (!updateResult.success) {
    logger.error(`Failed to save changes to database: ${updateResult.error}`);
    return {
      success: false,
      message: 'Failed to save changes to the database.',
    };
  }

  return {
    success: true,
    repaidAmount: repaymentAmount,
    refundedAmount: refundAmount,
    remainingDebt: player.debt,
    newBalance: player.cash,
  };
};
