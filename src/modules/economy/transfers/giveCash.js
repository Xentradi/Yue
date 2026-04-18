const Player = require('../../../models/Player');

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
  amount,
) {
  const transferResult = await Player.transferCurrency(
    guildId,
    fromUserId,
    toUserId,
    amount,
  );

  if (!transferResult.success) {
    return transferResult;
  }

  return {
    success: true,
    transferredAmount: transferResult.transferredAmount,
    toUser: toUserId,
    fromUser: fromUserId,
    newBalance: transferResult.playerA.cash,
    cash: transferResult.playerA.cash,
    bank: transferResult.playerA.bank,
    debt: transferResult.playerA.debt,
  };
};
