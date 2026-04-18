const logger = require('../../../utils/logger');
const Player = require('../../../models/Player');

/**
 * Retrieves the balance details (cash, bank, and debt) for a specific player.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user whose balance details need to be retrieved.
 * @param {string} guildId - The ID of the guild (server) where the user is a member.
 * @returns {Promise<Object>} An object indicating success status and potentially containing the player's cash, bank, and debt balances.
 * @throws Will log an error if there's an issue with database access.
 */
module.exports = async function getBalance(userId, guildId) {
  try {
    const player = await Player.findOne({ userId, guildId })
      .select('cash bank debt -_id')
      .lean();
    if (!player) {
      return {
        success: false,
        message: 'User not found.',
      };
    }

    return {
      success: true,
      cash: player.cash,
      bank: player.bank,
      debt: player.debt,
    };
  } catch (err) {
    logger.error(`Error occurred while fetching the player's balance: ${err}`);
    return {
      success: false,
      message: 'An error occurred while fetching the balance.',
    };
  }
};
