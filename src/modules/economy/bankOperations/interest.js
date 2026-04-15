const Player = require('../../../models/Player');
const logger = require('../../../utils/logger');

/**
 * Applies a variable interest rate to all player's bank balances and debt within a specific guild.
 * The bank interest rate varies between 0.1% to 0.3%, and the debt interest rate varies between 0.2% to 0.5%.
 *
 * @async
 * @function
 * @param {string} [guildId] - The ID of the guild to update. If omitted, all players are updated.
 * @returns {Promise<Object>} An object containing the operation status and message.
 * @throws Will log an error if there's an issue with database access.
 */
module.exports = async function applyBankInterest(guildId) {
  let players;
  try {
    players = await Player.find(guildId ? { guildId } : {});
  } catch (error) {
    logger.error(`An error occurred while fetching players: ${error}`);
    return {
      success: false,
      message: 'Database error.',
    };
  }

  if (!players || players.length === 0) {
    return {
      success: false,
      message: 'No players found.',
    };
  }

  // Randomly generate bank and debt interest rates
  const baseBankInterestRate = 0.001 + Math.random() * 0.002; // 0.1% to 0.3%
  const debtInterestRate = 0.002 + Math.random() * 0.003; // 0.2% to 0.5%

  let updatedCount = 0;
  let skippedCount = 0;

  for (const player of players) {
    if (
      !Number.isFinite(player.bank) ||
      player.bank < 0 ||
      !Number.isFinite(player.debt) ||
      player.debt < 0 ||
      !Number.isFinite(player.interestMultiplier) ||
      player.interestMultiplier < 0
    ) {
      skippedCount += 1;
      logger.error(
        `Skipping invalid player record during interest application: guildId=${player.guildId}, userId=${player.userId}`,
      );
      continue;
    }

    const bankInterestRate = baseBankInterestRate * player.interestMultiplier;
    const nextValues = {
      bank: player.bank,
      debt: player.debt,
    };

    if (player.bank > 1000) {
      // Minimum balance threshold for bank interest
      const bankInterest = Math.round(player.bank * bankInterestRate);
      nextValues.bank += bankInterest;
    }

    // Assuming debt is a property on the player model and is a negative value
    if (player.debt && player.debt > 0) {
      const debtInterest = Math.round(player.debt * debtInterestRate);
      nextValues.debt += debtInterest;
    }

    const updateResult = await player.setValues(nextValues);
    if (!updateResult.success) {
      skippedCount += 1;
      logger.error(
        `An error occurred while applying bank and debt interests: ${updateResult.error}`,
      );
      continue;
    }

    updatedCount += 1;
  }

  return {
    success: true,
    message: `Bank and debt interests successfully applied for ${updatedCount} player(s). Skipped ${skippedCount} invalid record(s).`,
    updatedCount,
    skippedCount,
  };
};
