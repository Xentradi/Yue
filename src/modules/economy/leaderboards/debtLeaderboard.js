const Player = require('../../../models/Player');

/**
 * Get the top players by debt.
 *
 * @async
 * @function
 * @param {string} guildId - The guild's ID.
 * @param {number} [limit=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of top players sorted by debt.
 */

module.exports = async function getDebtLeaderboard(guildId, topN = 10) {
  const players = await Player.find({guildId})
    .sort({debt: -1})
    .limit(topN)
    .select('userId debt -_id');
  return players;
};
