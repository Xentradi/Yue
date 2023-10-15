const Player = require('../../../models/Player');

/**
 * Withdraws a specified amount of cash from a player's bank account.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @param {number} amount - The amount of cash to withdraw.
 * @returns {Promise<Object|null|boolean>}
 *  - An object containing the transaction result if the withdrawal was successful.
 *  - `null` if the player is not found.
 *  - `false` if the withdrawal amount is invalid.
 * @returns {boolean} success - Indicates if the withdrawal was successful.
 * @returns {number} amount - The amount withdrawn.
 * @returns {number} cash - The updated cash balance after withdrawal.
 * @returns {number} bank - The updated bank balance after withdrawal.
 */

module.exports.withdraw = async function withdraw(userId, guildId, amount) {
  const player = await Player.findOne({userId, guildId});
  if (!player) return null; // Handle player not found
  if (amount <= 0 || player.bank < amount) return false; // Handle invalid amount

  player.bank -= amount;
  player.cash += amount;

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
      message: 'An error occurred while processing the transaction.',
    };
  }
};
