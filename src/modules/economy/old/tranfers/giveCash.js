const Player = require('../../../models/Player');
const balance = require('../../economy/balance');

/**
 * Transfers cash from one player to another.
 *
 * @async
 * @function
 * @param {string} fromUserId - The ID of the user transferring cash.
 * @param {string} toUserId - The ID of the recipient user.
 * @param {string} guildId - The ID of the guild (server) where both users are members.
 * @param {number} amount - The amount of cash to transfer.
 * @returns {Promise<Object>} An object containing transaction details and status of operation.
 */
module.exports = async function giveCash(
  fromUserId,
  toUserId,
  guildId,
  amount
) {
  const fromPlayer = await Player.findOne({userId: fromUserId, guildId});
  const toPlayer = await Player.findOne({userId: toUserId, guildId});

  if (!fromPlayer) {
    return {
      success: false,
      message: 'Sender not found in the database.',
    };
  }

  if (!toPlayer) {
    return {
      success: false,
      message: 'Recipient not found in the database.',
    };
  }

  if (amount <= 0 || fromPlayer.cash < amount) {
    return {
      success: false,
      message:
        amount <= 0
          ? 'Invalid transfer amount.'
          : 'Insufficient funds to complete the transfer.',
    };
  }

  await balance.updatePlayerCash(fromPlayer, -amount);
  await balance.updatePlayerCash(toPlayer, amount);

  return {
    success: true,
    transferredAmount: amount,
    toUser: toUserId,
    fromUser: fromUserId,
    newBalance: fromPlayer.cash,
  };
};
