const Player = require('../../../models/Player');
const config = require('../../../config.json');

/**
 * Provides a daily cash bonus to a player.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @returns {Promise<Object|null>}
 *  - An object containing the transaction result if the bonus was granted successfully.
 *  - `null` if the player is not found.
 * @returns {boolean} success - Indicates if the bonus was granted successfully.
 * @returns {number} amount - The bonus amount.
 * @returns {number} cash - The updated cash balance after the bonus is granted.
 */

module.exports.dailyBonus = async function dailyBonus(userId, guildId) {
  const player = await Player.findOne({userId, guildId});
  if (!player) return null; // Handle player not found

  const bonusAmount = config.dailyWage ?? 500; // Or any other amount
  player.cash += bonusAmount;

  try {
    await player.save();
    return {
      success: true,
      amount: bonusAmount,
      cash: player.cash,
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: 'An error occurred while granting the daily bonus.'
    };
  }
};
