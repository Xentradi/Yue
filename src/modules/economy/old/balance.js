const logger = require('../../../utils/logger');

/**
 * Updates a player's cash balance.
 *
 * @async
 * @param {Object} player - The player object.
 * @param {number} amount - The amount to update the player's cash by.
 * @returns {Promise<Object>} An object containing the success status and the updated cash amount or error message.
 */
module.exports.updatePlayerCash = async function (player, amount) {
  if (!player) return {success: false, message: 'Player not found.'};

  player.cash = Math.max(player.cash + amount, 0);

  try {
    await player.save();
    return {success: true, cash: player.cash};
  } catch (err) {
    logger.error(`Error updating cash balance: ${err}`);
    return {success: false, message: 'Error updating cash balance.'};
  }
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
  if (!player) return {success: false, message: 'Player not found.'};

  player.bank = Math.max(player.bank + amount, 0);

  try {
    await player.save();
    return {success: true, bank: player.bank};
  } catch (err) {
    logger.error(`Error updating bank balance: ${err}`);
    return {success: false, message: 'Error updating bank balance.'};
  }
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
  if (!player) return {success: false, message: 'Player not found.'};

  if (toBank) {
    if (player.cash < amount)
      return {success: false, message: 'Insufficient cash.'};
    player.cash -= amount;
    player.bank += amount;
  } else {
    if (player.bank < amount)
      return {success: false, message: 'Insufficient bank funds.'};
    player.bank -= amount;
    player.cash += amount;
  }

  try {
    await player.save();
    return {success: true, cash: player.cash, bank: player.bank};
  } catch (err) {
    logger.error(`Error updating transfering funds: ${err}`);
    return {success: false, message: 'Error transferring funds.'};
  }
};
