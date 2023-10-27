const Player = require('../../models/Player');
const balance = require('../economy/balance');

/**
 * Performs a coin flip, updates the player's cash balance based on the result, and returns detailed information about the operation.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user performing the coin flip.
 * @param {string} guildId - The ID of the guild (server) where the coin flip is performed.
 * @param {string} choice - The player's choice ('heads' or 'tails').
 * @param {number} betAmount - The amount of cash the player bets.
 * @returns {Promise<Object>} An object containing details about the coin flip outcome, whether the player won or lost, the prize or loss amount, and updated player balances.
 *
 * @throws Will throw an error if there are issues in updating the player's cash balance.
 *
 * @typedef {Object} CoinFlipResult
 * @property {boolean} success - Indicates whether the coin flip operation was successful.
 * @property {string} outcome - The outcome of the coin flip ('heads' or 'tails').
 * @property {string} playerChoice - The player's choice ('heads' or 'tails').
 * @property {number} betAmount - The amount of cash the player bet.
 * @property {boolean} win - Indicates whether the player won the coin flip.
 * @property {number} prize - The prize amount if the player wins, or the loss amount (negative) if the player loses.
 * @property {number} playerBalanceBefore - The player's cash balance before the coin flip.
 * @property {number} playerBalanceAfter - The player's cash balance after the coin flip and balance update.
 * @property {string} [message] - Additional message, e.g., errors or insufficient funds notification.
 */

module.exports = async function coinFlip(userId, guildId, choice, betAmount) {
  const player = await Player.findOne({userId, guildId});

  const result = {
    success: false,
    outcome: Math.random() < 0.5 ? 'heads' : 'tails',
    playerChoice: choice,
    betAmount,
    win: false,
    prize: 0,
    playerBalanceBefore: player?.cash || 0,
    playerBalanceAfter: player?.cash || 0,
  };

  if (!player) {
    result.message = 'Player not found in the database.';
    return result;
  }

  if (player.cash < betAmount) {
    result.message = 'Insufficient funds to place the bet.';
    return result;
  }

  const betResult = result.outcome === choice;
  const updateAmount = betResult ? betAmount : -betAmount;

  const updateResult = await balance.updatePlayerCash(player, updateAmount);

  if (updateResult.success) {
    result.win = betResult;
    result.prize = betResult ? betAmount : -betAmount;
    result.playerBalanceAfter = updateResult.cash;
    result.success = true;
  } else {
    result.message = 'An error occurred while processing the bet.';
  }

  return result;
};
