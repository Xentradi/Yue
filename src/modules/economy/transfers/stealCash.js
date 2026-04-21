const logger = require('../../../utils/logger');
const { ensurePlayers, findPlayer } = require('../playerService');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

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
  try {
    const result = await withTransaction(async (client) => {
      await ensurePlayers(
        [
          { guildId, userId },
          { guildId, userId: targetUserId },
        ],
        { client },
      );

      const [player, target] = await Promise.all([
        findPlayer(userId, guildId, { client, lock: true }),
        findPlayer(targetUserId, guildId, { client, lock: true }),
      ]);

      if (!player || !target) {
        return {
          successful: false,
          amountStolen: 0,
          penalty: 0,
          playerCash: 0,
          playerBank: 0,
          playerDebt: 0,
          targetCash: 0,
          message: 'Failed to initialize steal participants.',
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

      const stealAmount = Math.min(amount, target.cash);
      const percentage = stealAmount / target.cash;
      const successRate =
        0.9 / Math.pow(1 + Math.exp(20 * (percentage - 0.1)), 4);

      const successful = Math.random() < successRate;
      const result = {
        successful,
        amountStolen: 0,
        playerCash: player.cash,
        playerBank: player.bank,
        playerDebt: player.debt,
        targetCash: target.cash,
      };

      if (successful) {
        const nextPlayerCash = Math.max(player.cash + stealAmount, 0);
        const nextTargetCash = Math.max(target.cash - stealAmount, 0);

        const playerUpdate = await player.setCash(nextPlayerCash, { client });
        const targetUpdate = await target.setCash(nextTargetCash, { client });

        if (!playerUpdate.success || !targetUpdate.success) {
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

        result.amountStolen = stealAmount;
        result.playerCash = player.cash;
        result.playerBank = player.bank;
        result.playerDebt = player.debt;
        result.targetCash = target.cash;
        return result;
      }

      const penalty = Math.ceil(getPenalty(stealAmount));
      let remainingPenalty = penalty;
      const cashPenalty = Math.min(player.cash, remainingPenalty);
      const nextCash = player.cash - cashPenalty;
      remainingPenalty -= cashPenalty;

      const bankPenalty = Math.min(player.bank, remainingPenalty);
      const nextBank = player.bank - bankPenalty;
      remainingPenalty -= bankPenalty;

      const nextDebt = player.debt + Math.max(remainingPenalty, 0);

      const playerUpdate = await player.setValues(
        {
          cash: nextCash,
          bank: nextBank,
          debt: nextDebt,
        },
        { client },
      );

      if (!playerUpdate.success) {
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

      result.penalty = penalty;
      result.playerCash = player.cash;
      result.playerBank = player.bank;
      result.playerDebt = player.debt;
      result.targetCash = target.cash;
      return result;
    });

    if (result.successful) {
      await Promise.all([
        bumpVersion('player', guildId),
        bumpVersion('leaderboard', guildId),
      ]);
    }

    return result;
  } catch (err) {
    logger.error(`Error updating balance information: ${err}`);
    return {
      successful: false,
      amountStolen: 0,
      penalty: 0,
      playerCash: 0,
      playerBank: 0,
      playerDebt: 0,
      targetCash: 0,
      message: 'Failed to persist steal attempt.',
    };
  }
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
