const Player = require('../../../models/Player');

/**
 * Get the top players by net worth.
 *
 * @async
 * @function
 * @param {string} guildId - The guild's ID.
 * @param {number} [limit=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of top players sorted by net worth.
 */

module.exports = async function getTopNetWorth(guildId, limit = 10) {
  // Aggregate players in the guild, calculate their net worth, and sort by descending net worth
  const topPlayers = await Player.aggregate([
    {$match: {guildId: guildId}},
    {
      $project: {
        userId: 1,
        netWorth: {$add: ['$cash', '$bank']}, // Calculate net worth as the sum of cash and bank
      },
    },
    {$sort: {netWorth: -1}}, // Sort in descending order
    {$limit: limit},
  ]);

  return topPlayers;
};
