const logger = require('../../utils/logger');

function isFiniteNumber(amount) {
  return typeof amount === 'number' && Number.isFinite(amount);
}

function getCurrentAmount(player, field) {
  const value = player?.[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function saveIfPossible(player, field, nextAmount) {
  const methodName = `set${field[0].toUpperCase()}${field.slice(1)}`;
  if (typeof player[methodName] === 'function') {
    const result = await player[methodName](nextAmount);
    if (result.success) {
      return { success: true, [field]: nextAmount };
    }
    return {
      success: false,
      message: result.error ?? `Error updating ${field} balance.`,
    };
  }

  const previousAmount = player[field];
  player[field] = nextAmount;

  try {
    await player.save();
    return { success: true, [field]: nextAmount };
  } catch (err) {
    player[field] = previousAmount;
    logger.error(`Error updating ${field} balance: ${err}`);
    return { success: false, message: `Error updating ${field} balance.` };
  }
}

/**
 * Updates a player's cash balance.
 *
 * @async
 * @param {Object} player - The player object.
 * @param {number} amount - The amount to update the player's cash by.
 * @returns {Promise<Object>} An object containing the success status and the updated cash amount or error message.
 */
module.exports.updatePlayerCash = async function (player, amount) {
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

  return saveIfPossible(player, 'cash', currentCash + amount);
};

/**
 * Updates a player's bank balance.
 *
 * @async
 * @param {Object} player - The player object.
 * @param {number} amount - The amount to update the player's bank by.
 * @returns {Promise<Object>} An object containing the success status and the updated bank amount or error message.
 */
module.exports.updatePlayerBank = async function (player, amount) {
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

  return saveIfPossible(player, 'bank', currentBank + amount);
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
module.exports.transferFunds = async function (player, amount, toBank = true) {
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
    const previousCash = player.cash;
    const previousBank = player.bank;
    player.cash = currentCash - amount;
    player.bank = currentBank + amount;

    try {
      await player.save();
      return { success: true, cash: player.cash, bank: player.bank };
    } catch (err) {
      player.cash = previousCash;
      player.bank = previousBank;
      logger.error(`Error updating transferring funds: ${err}`);
      return { success: false, message: 'Error transferring funds.' };
    }
  } else {
    if (currentBank < amount)
      return { success: false, message: 'Insufficient bank funds.' };
    const previousBank = player.bank;
    const previousCash = player.cash;
    player.bank = currentBank - amount;
    player.cash = currentCash + amount;

    try {
      await player.save();
      return { success: true, cash: player.cash, bank: player.bank };
    } catch (err) {
      player.bank = previousBank;
      player.cash = previousCash;
      logger.error(`Error updating transferring funds: ${err}`);
      return { success: false, message: 'Error transferring funds.' };
    }
  }
};
