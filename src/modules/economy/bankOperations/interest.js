const Player = require('../../../models/Player');

/**
 * Applies a variable interest rate to all player's bank balances and debt within a specific guild.
 * The bank interest rate varies between 0.1% to 0.3%, and the debt interest rate varies between 0.2% to 0.5%.
 *
 * @async
 * @function
 * @returns {Promise<Object>} An object containing the operation status and message.
 * @throws Will log an error if there's an issue with database access.
 */
module.exports = async function applyBankInterest() {
  let players;
  try {
    players = await Player.find();
  } catch (error) {
    console.error('Error fetching players: ', error);
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

  players.forEach(player => {
    const interestMultiplier = player.interestMultiplier || 1;
    const bankInterestRate = baseBankInterestRate * interestMultiplier;

    if (player.bank > 1000) {
      // Minimum balance threshold for bank interest
      const bankInterest = Math.round(player.bank * bankInterestRate);
      player.bank += bankInterest;
    }

    // Assuming debt is a property on the player model and is a negative value
    if (player.debt && player.debt > 0) {
      const debtInterest = Math.round(player.debt * debtInterestRate);
      player.debt += debtInterest;
    }
  });

  try {
    await Promise.all(players.map(player => player.save()));
    return {
      success: true,
      message: 'Bank and debt interests successfully applied.',
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: 'An error occurred while applying bank and debt interests.',
    };
  }
};
