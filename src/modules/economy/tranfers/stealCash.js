const Player = require('../../../models/Player');
const logger = require('../../../utils/logger');

/**
 * Attempt to steal cash from another user.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user attempting the steal.
 * @param {string} targetUserId - The ID of the user being targeted for the steal.
 * @param {string} guildId - The ID of the guild (server).
 * @param {number} amount - The amount the user wants to steal.
 * @returns {Promise<Object|null>} An object containing the outcome of the steal attempt, amount stolen, and new balances, or `null` if one or both players are not found.
 * @throws Will log an error if saving to the database fails.
 */
module.exports = async function stealCash(
  userId,
  targetUserId,
  guildId,
  amount
) {
  const player = await Player.findOne({userId, guildId});
  const target = await Player.findOne({userId: targetUserId, guildId});

  if (!player || !target) return null; // Handle players not found

  // If the thief tries to steal more than the target has, default the amount to the target's total cash
  if (amount > target.cash) {
    amount = target.cash;
  }

  // Calculate success rate based on the new equation
  const percentage = amount / target.cash;
  const successRate = 0.9 / Math.pow(1 + Math.exp(20 * (percentage - 0.1)), 4);

  const successful = Math.random() < successRate;

  const result = {
    successful: successful,
    amountStolen: 0,
    playerCash: player.cash,
    targetCash: target.cash,
  };

  if (successful) {
    player.cash += amount;
    target.cash -= amount;

    // Ensuring cash doesn't go below zero
    player.cash = Math.max(player.cash, 0);
    target.cash = Math.max(target.cash, 0);

    result.amountStolen = amount;
    result.playerCash = player.cash;
    result.targetCash = target.cash;
  } else {
    const penalty = Math.ceil(getPenalty(amount));

    player.cash -= penalty;
    if (player.cash < 0) {
      player.bank += player.cash; // If cash goes negative, subtract from bank
      player.cash = 0;
    }

    if (player.bank < 0) {
      player.debt -= player.bank; // If bank goes negative, add to debt
      player.bank = 0;
    }

    result.penalty = penalty;
  }
  // Ensuring bank doesn't go below zero
  player.bank = Math.max(player.bank, 0);

  try {
    await player.save();
    await target.save();
  } catch (err) {
    logger.error(`Error updating balance information: ${err}`);
  }

  return result;
};

const getPenalty = amount => {
  let penaltyRate = 1.5; // 150% base penalty

  if (amount > 1000) {
    penaltyRate += 2; // Additional 200%
  } else if (amount > 500) {
    penaltyRate += 1; // Additional 100%
  } else if (amount > 100) {
    penaltyRate += 0.5; // Additional 50%
  }

  return amount * penaltyRate;
};
