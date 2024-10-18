const Player = require('../../../models/Player');

/**
 * Get the top players by cash amount.
 *
 * @async
 * @function
 * @param {string} guildId - The guild's ID.
 * @param {number} [topN=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of top players sorted by cash amount, only including their user ID and cash amount.
 */

module.exports = async function getCashLeaderboard(guildId, topN = 10) {
  const players = await Player.find({guildId})
    .sort({cash: -1})
    .limit(topN)
    .select('userId cash -_id');
  return players;
};
