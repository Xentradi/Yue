const logger = require('../../../utils/logger');
const { findPlayersByUserIds } = require('../playerService');

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
  amount,
) {
  const [player, target] = await findPlayersByUserIds(
    [userId, targetUserId],
    guildId,
  ).then((players) => [
    players.find((entry) => entry.userId === userId) ?? null,
    players.find((entry) => entry.userId === targetUserId) ?? null,
  ]);

  if (!player) {
    return {
      successful: false,
      amountStolen: 0,
      penalty: 0,
      playerCash: 0,
      playerBank: 0,
      playerDebt: 0,
      targetCash: 0,
      message: 'Stealing player not found.',
    };
  }

  if (!target) {
    return {
      successful: false,
      amountStolen: 0,
      penalty: 0,
      playerCash: player.cash,
      playerBank: player.bank,
      playerDebt: player.debt,
      targetCash: 0,
      message: 'Target player not found.',
    };
  }

  if (
    !Number.isFinite(player.cash) ||
    !Number.isFinite(player.bank) ||
    !Number.isFinite(player.debt) ||
    player.cash < 0 ||
    player.bank < 0 ||
    player.debt < 0 ||
    !Number.isFinite(target.cash) ||
    target.cash < 0
  ) {
    return {
      successful: false,
      amountStolen: 0,
      penalty: 0,
      playerCash: player.cash,
      playerBank: player.bank,
      playerDebt: player.debt,
      targetCash: target.cash,
      message: 'Player balances are invalid.',
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      successful: false,
      amountStolen: 0,
      penalty: 0,
      playerCash: player.cash,
      playerBank: player.bank,
      playerDebt: player.debt,
      targetCash: target.cash,
      message: 'Invalid steal amount.',
    };
  }

  if (target.cash <= 0) {
    return {
      successful: false,
      amountStolen: 0,
      penalty: 0,
      playerCash: player.cash,
      playerBank: player.bank,
      playerDebt: player.debt,
      targetCash: target.cash,
      message: 'Target has no cash to steal.',
    };
  }

  // If the thief tries to steal more than the target has, default the amount to the target's total cash
  const stealAmount = Math.min(amount, target.cash);

  // Calculate success rate based on the new equation
  const percentage = stealAmount / target.cash;
  const successRate = 0.9 / Math.pow(1 + Math.exp(20 * (percentage - 0.1)), 4);

  const successful = Math.random() < successRate;
  const previousPlayer = {
    cash: player.cash,
    bank: player.bank,
    debt: player.debt,
  };
  const previousTargetCash = target.cash;

  const result = {
    successful: successful,
    amountStolen: 0,
    playerCash: player.cash,
    playerBank: player.bank,
    playerDebt: player.debt,
    targetCash: target.cash,
  };

  if (successful) {
    player.cash += stealAmount;
    target.cash -= stealAmount;

    // Ensuring cash doesn't go below zero
    player.cash = Math.max(player.cash, 0);
    target.cash = Math.max(target.cash, 0);

    result.amountStolen = stealAmount;
    result.playerCash = player.cash;
    result.playerBank = player.bank;
    result.playerDebt = player.debt;
    result.targetCash = target.cash;
  } else {
    const penalty = Math.ceil(getPenalty(stealAmount));

    let remainingPenalty = penalty;
    const cashPenalty = Math.min(player.cash, remainingPenalty);
    player.cash -= cashPenalty;
    remainingPenalty -= cashPenalty;

    const bankPenalty = Math.min(player.bank, remainingPenalty);
    player.bank -= bankPenalty;
    remainingPenalty -= bankPenalty;

    if (remainingPenalty > 0) {
      player.debt += remainingPenalty;
    }

    result.penalty = penalty;
    result.playerBank = player.bank;
    result.playerDebt = player.debt;
  }
  // Ensuring bank doesn't go below zero
  player.bank = Math.max(player.bank, 0);

  try {
    await player.save();
    await target.save();
  } catch (err) {
    player.cash = previousPlayer.cash;
    player.bank = previousPlayer.bank;
    player.debt = previousPlayer.debt;
    target.cash = previousTargetCash;
    try {
      await Promise.all([player.save(), target.save()]);
    } catch (rollbackErr) {
      logger.error(`Failed to roll back steal attempt: ${rollbackErr}`);
    }
    logger.error(`Error updating balance information: ${err}`);
    return {
      successful: false,
      amountStolen: 0,
      penalty: 0,
      playerCash: player.cash,
      playerBank: player.bank,
      playerDebt: player.debt,
      targetCash: target.cash,
      message: 'Failed to persist steal attempt.',
    };
  }

  return result;
};

const getPenalty = (amount) => {
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
