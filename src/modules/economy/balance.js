const logger = require('../../utils/logger');

function isFiniteNumber(amount) {
  return typeof amount === 'number' && Number.isFinite(amount);
}

function getCurrentAmount(player, field) {
  const value = player?.[field];
  if (value === undefined || value === null) {
    return 0;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Updates a player's cash balance.
 *
 * @async
 * @param {Object} player - The player object.
 * @param {number} amount - The amount to update the player's cash by.
 * @returns {Promise<Object>} An object containing the success status and the updated cash amount or error message.
 */
module.exports.updatePlayerCash = async function (
  player,
  amount,
  options = {},
) {
  if (!player) return { success: false, message: 'Player not found.' };
  if (!isFiniteNumber(amount)) {
    return { success: false, message: 'Invalid amount.' };
  }
  const currentCash = getCurrentAmount(player, 'cash');
  if (currentCash === null) {
    return { success: false, message: 'Player cash balance is invalid.' };
  }
  if (currentCash + amount < 0) {
    return { success: false, message: 'Insufficient cash.' };
  }
  const result = await player.adjustCash(amount, options);
  if (!result.success) {
    return {
      success: false,
      message: result.error ?? 'Error updating cash balance.',
    };
  }
  return { success: true, cash: player.cash };
};

/**
 * Updates a player's bank balance.
 *
 * @async
 * @param {Object} player - The player object.
 * @param {number} amount - The amount to update the player's bank by.
 * @returns {Promise<Object>} An object containing the success status and the updated bank amount or error message.
 */
module.exports.updatePlayerBank = async function (
  player,
  amount,
  options = {},
) {
  if (!player) return { success: false, message: 'Player not found.' };
  if (!isFiniteNumber(amount)) {
    return { success: false, message: 'Invalid amount.' };
  }
  const currentBank = getCurrentAmount(player, 'bank');
  if (currentBank === null) {
    return { success: false, message: 'Player bank balance is invalid.' };
  }
  if (currentBank + amount < 0) {
    return { success: false, message: 'Insufficient bank funds.' };
  }
  const result = await player.adjustBank(amount, options);
  if (!result.success) {
    return {
      success: false,
      message: result.error ?? 'Error updating bank balance.',
    };
  }
  return { success: true, bank: player.bank };
};

/**
 * Transfers funds between a player's cash and bank balances.
 *
 * @async
 * @param {Object} player - The player object.
 * @param {number} amount - The amount to transfer.
 * @param {boolean} [toBank=true] - Whether to transfer to bank, otherwise transfer to cash.
 * @returns {Promise<Object>} An object containing the success status and the updated cash and bank amounts or error message.
 */
module.exports.transferFunds = async function (
  player,
  amount,
  toBank = true,
  options = {},
) {
  if (!player) return { success: false, message: 'Player not found.' };
  if (!isFiniteNumber(amount) || amount <= 0) {
    return { success: false, message: 'Invalid transfer amount.' };
  }

  const currentCash = getCurrentAmount(player, 'cash');
  const currentBank = getCurrentAmount(player, 'bank');
  if (currentCash === null) {
    return { success: false, message: 'Player cash balance is invalid.' };
  }
  if (currentBank === null) {
    return { success: false, message: 'Player bank balance is invalid.' };
  }

  if (toBank) {
    if (currentCash < amount)
      return { success: false, message: 'Insufficient cash.' };
    const result = await player.incrementValues(
      {
        cash: -amount,
        bank: amount,
      },
      options,
    );
    if (!result.success) {
      logger.error(`Error updating transferring funds: ${result.error}`);
      return { success: false, message: 'Error transferring funds.' };
    }
    return { success: true, cash: player.cash, bank: player.bank };
  } else {
    if (currentBank < amount)
      return { success: false, message: 'Insufficient bank funds.' };
    const result = await player.incrementValues(
      {
        bank: -amount,
        cash: amount,
      },
      options,
    );
    if (!result.success) {
      logger.error(`Error updating transferring funds: ${result.error}`);
      return { success: false, message: 'Error transferring funds.' };
    }
    return { success: true, cash: player.cash, bank: player.bank };
  }
};
