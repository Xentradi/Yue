const { findPlayer, updatePlayerValues } = require('../playerService');

/**
 * Allows a player to take a loan from the bank. The loan incurs a 10% immediate interest.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user attempting to take the loan.
 * @param {string} guildId - The ID of the guild (server) where the user is a member.
 * @param {number} amount - The amount the player wishes to borrow.
 * @returns {Promise<Object|boolean|null>} An object containing the outcome of the loan or `false` if the loan couldn't be taken, or `null` if the player was not found.
 * @throws Will log an error if saving to the database fails.
 */
module.exports = async function takeLoan(userId, guildId, amount) {
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
      message: 'Invalid loan amount.',
    };
  }

  if (player.debt > 0) {
    return {
      success: false,
      message:
        'Existing debt detected. Cannot take another loan until the current debt is cleared.',
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

  const updateResult = await updatePlayerValues(player, {
    cash: player.cash + amount,
    debt: player.debt + amount * 1.1,
  });

  if (!updateResult.success) {
    return {
      success: false,
      message: updateResult.error,
    };
  }

  return {
    success: true,
    loanAmount: amount,
    newDebt: player.debt,
    newBalance: player.cash,
  };
};
