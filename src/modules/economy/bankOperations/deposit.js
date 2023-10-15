const Player = require('../../../models/Player');

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
  const player = await Player.findOne({userId, guildId});

  if (!player) {
    return {
      success: false,
      message: 'Player not found in the database.',
    };
  }

  if (amount <= 0) {
    return {
      success: false,
      message: 'Invalid deposit amount.',
    };
  }

  if (player.cash < amount) {
    return {
      success: false,
      message: 'Insufficient funds to deposit.',
    };
  }

  player.cash -= amount;
  player.bank += amount;

  try {
    await player.save();
    return {
      success: true,
      amount: amount,
      cash: player.cash,
      bank: player.bank,
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: 'An error occurred while processing the deposit.',
    };
  }
};
