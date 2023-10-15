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
 * @throws Will log an error if saving to the database fails.
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

  if (fromPlayer.cash < amount) {
    return {
      success: false,
      message: 'Insufficient funds to complete the transfer.',
    };
  }

  if (amount <= 0) {
    return {
      success: false,
      message: 'Invalid transfer amount.',
    };
  }

  fromPlayer.cash -= amount;
  toPlayer.cash += amount;

  try {
    await fromPlayer.save();
    await toPlayer.save();
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: 'An error occurred while processing the transaction.',
    };
  }

  return {
    success: true,
    transferredAmount: amount,
    toUser: toUserId,
    fromUser: fromUserId,
    newBalance: fromPlayer.cash,
  };
};
