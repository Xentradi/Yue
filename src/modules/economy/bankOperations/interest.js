const Player = require('../../../models/Player');

/**
 * Applies a variable interest rate to all player's bank balances and debt within a specific guild.
 * The bank interest rate varies between 0.1% to 0.3%, and the debt interest rate varies between 0.2% to 0.5%.
 *
 * @async
 * @function
 * @param {string} guildId - The ID of the guild (server) for which the interest should be applied.
 * @returns {Promise<void>} Resolves when all player balances have been updated.
 */

module.exports.applyBankInterest = async function applyBankInterest(guildId) {
  const players = await Player.find({guildId});

  // Randomly generate bank and debt interest rates
  const bankInterestRate = 0.001 + Math.random() * 0.002; // 0.1% to 0.3%
  const debtInterestRate = 0.002 + Math.random() * 0.003; // 0.2% to 0.5%

  players.forEach(player => {
    if (player.bank > 1000) {
      // Minimum balance threshold for bank interest
      const bankInterest = Math.round(player.bank * bankInterestRate);
      player.bank += bankInterest;
    }

    // Assuming debt is a property on the player model and is a negative value
    if (player.debt && player.debt < 0) {
      const debtInterest = Math.round(player.debt * debtInterestRate);
      player.debt += debtInterest;
    }
  });

  try {
    await Promise.all(players.map(player => player.save()));
  } catch (err) {
    console.error(err);
  }
};
