const Player = require('../../../models/Player');
const balance = require('../../economy/balance');

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
      message: 'Invalid withdrawal amount.',
    };
  }

  if (player.bank < amount) {
    return {
      success: false,
      message: 'Insufficient funds in the bank for withdrawal.',
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
        }
      : transferResult;
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'An error occurred while processing the withdrawl.',
    };
  }
};
