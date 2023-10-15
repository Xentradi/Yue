const Player = require('../../../models/Player');

/**
 * Deposits a specified amount of cash into a player's bank account.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @param {number} amount - The amount of cash to deposit.
 * @returns {Promise<Object|null>} An object containing the transaction result, or `null` if the player is not found.
 * @returns {boolean} success - Indicates if the deposit was successful.
 * @returns {number} amount - The amount deposited.
 * @returns {number} cash - The updated cash balance after deposit.
 * @returns {number} bank - The updated bank balance after deposit.
 */

module.exports.deposit = async function deposit(userId, guildId, amount) {
  const player = await Player.findOne({userId, guildId});
  if (!player) return null; // Handle player not found
  if (amount <= 0 || player.cash < amount) return false; // Handle invalid amount

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
  }
};
