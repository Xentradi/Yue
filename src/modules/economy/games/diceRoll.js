const Player = require('../../../models/Player');
const balance = require('../../economy/balance');

/**
 * Performs a dice roll, updates the player's cash balance based on the result, and returns detailed information about the operation.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user performing the dice roll.
 * @param {string} guildId - The ID of the guild (server) where the dice roll is performed.
 * @param {number} choice - The player's chosen number (1-6).
 * @param {number} betAmount - The amount of cash the player bets.
 * @returns {Promise<Object>} An object containing details about the dice roll outcome, whether the player won or lost, the prize or loss amount, and updated player balances.
 *
 * @typedef {Object} DiceRollResult
 * @property {boolean} success - Indicates whether the dice roll operation was successful.
 * @property {number} outcome - The outcome of the dice roll (1-6).
 * @property {number} playerChoice - The player's chosen number (1-6).
 * @property {number} betAmount - The amount of cash the player bet.
 * @property {boolean} win - Indicates whether the player won the dice roll.
 * @property {number} prize - The prize amount if the player wins, or the loss amount (negative) if the player loses.
 * @property {number} playerBalanceBefore - The player's cash balance before the dice roll.
 * @property {number} playerBalanceAfter - The player's cash balance after the dice roll and balance update.
 * @property {string} [message] - Additional message, e.g., errors or insufficient funds notification.
 */
module.exports = async function diceRoll(userId, guildId, choice, betAmount) {
  const player = await Player.findOne({userId, guildId});

  const result = {
    success: false,
    outcome: Math.floor(Math.random() * 6) + 1,
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

  result.playerBalanceBefore = player.cash;

  if (result.outcome === choice) {
    const {success} = await balance.updatePlayerCash(player, betAmount * 5);
    result.win = success;
    result.prize = success ? betAmount * 5 : 0;
  } else {
    const {success} = await balance.updatePlayerCash(player, -betAmount);
    result.prize = success ? -betAmount : 0;
  }

  result.playerBalanceAfter = player.cash;
  result.success = true;

  return result;
};
