const Player = require('../../../models/Player');

/**
 * Get the top players by bank balance.
 *
 * @async
 * @function
 * @param {string} guildId - The guild's ID.
 * @param {number} [topN=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of top players sorted by bank balance, only including their user ID and bank balance.
 */

module.exports.getBankLeaderboard = async function getBankLeaderboard(
  guildId,
  topN = 10
) {
  const players = await Player.find({guildId})
    .sort({bank: -1})
    .limit(topN)
    .select('userId bank -_id');
  return players;
};
