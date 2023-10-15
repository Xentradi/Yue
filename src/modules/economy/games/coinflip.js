const Player = require('../../../models/Player');

/**
 * Plays a coin flip game where the player bets on 'heads' or 'tails'.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @param {string} choice - The player's choice ('heads' or 'tails').
 * @param {number} betAmount - The amount the player is betting.
 * @returns {Promise<Object|null>} An object containing the outcome of the coin flip, win status, and prize amount, or `null` if the player has insufficient funds or is not found.
 * @throws Will log an error if saving to the database fails.
 */
module.exports = async function coinflip(userId, guildId, choice, betAmount) {
  const player = await Player.findOne({userId, guildId});
  if (!player || player.cash < betAmount) return null; // Handle insufficient funds or player not found

  const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
  const result = {
    outcome: outcome,
    win: false,
    prize: 0,
  };

  if (outcome === choice) {
    player.cash += betAmount; // Player wins the bet
    result.win = true;
    result.prize = betAmount;
  } else {
    player.cash -= betAmount; // Player loses the bet
    result.prize = -betAmount; // Negative indicates a loss
  }

  try {
    await player.save();
  } catch (err) {
    console.error(err);
  }

  return result;
};
