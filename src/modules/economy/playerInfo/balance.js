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
module.exports.getBalance = async function getBalance(userId, guildId) {
  try {
    const player = await Player.findOne({userId, guildId});

    // If the player doesn't exist in the database, return a success value of false with an appropriate message
    if (!player) {
      return {
        success: false,
        message: 'Player not found in the database.',
      };
    }

    // If everything is okay, return the player's balances with a success value of true
    return {
      success: true,
      cash: player.cash,
      bank: player.bank,
      debt: player.debt,
    };
  } catch (err) {
    // Log any errors and return a success value of false with a generic error message
    console.error(err);
    return {
      success: false,
      message: "An error occurred while fetching the player's balance.",
    };
  }
};
