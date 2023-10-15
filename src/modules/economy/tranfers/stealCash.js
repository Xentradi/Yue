const Player = require('../../../models/Player');

/**
 * Attempt to steal cash from another user.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user attempting the steal.
 * @param {string} targetUserId - The ID of the user being targeted for the steal.
 * @param {string} guildId - The ID of the guild (server).
 * @returns {Promise<Object|null>} An object containing the outcome of the steal attempt, amount stolen, and new balances, or `null` if one or both players are not found.
 * @throws Will log an error if saving to the database fails.
 */
module.exports.stealCash = async function stealCash(
  userId,
  targetUserId,
  guildId
) {
  const player = await Player.findOne({userId, guildId});
  const target = await Player.findOne({userId: targetUserId, guildId});

  if (!player || !target) return null; // Handle players not found

  const successRate = 0.1; // 10% success rate
  const successful = Math.random() < successRate;

  const result = {
    successful: successful,
    amountStolen: 0,
    playerCash: player.cash,
    targetCash: target.cash,
  };

  if (successful) {
    const amountToSteal = Math.floor(Math.random() * target.cash * 0.1); // Steal up to 10% of target's cash
    player.cash += amountToSteal;
    target.cash -= amountToSteal;

    result.amountStolen = amountToSteal;
    result.playerCash = player.cash;
    result.targetCash = target.cash;

    try {
      await player.save();
      await target.save();
    } catch (err) {
      console.error(err);
    }
  }

  return result;
};
