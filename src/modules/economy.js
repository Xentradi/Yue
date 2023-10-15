const Player = require('../models/Player');
const config = require('../config.json');

// Player Information

// Get player balance
module.exports.getBalance = async function getBalance(userId, guildId) {
  const player = await Player.findOne({userId, guildId});
  if (!player) return null; // or throw an error if the player doesn't exist

  return {
    cash: player.cash,
    bank: player.bank,
    debt: player.debt,
  };
};

// Bank Operations

// Loans

// Take Loan From Bank
module.exports.takeLoan = async function takeLoan(userId, guildId, amount) {
  const player = await Player.findOne({userId, guildId});
  if (!player) return null; // Handle player not found
  if (amount <= 0 || player.debt > 0) return false; // Can't take a loan if they already have debt

  player.cash += amount;
  player.debt += amount * 1.1; // Loan with 10% immediate interest

  await player.save();
  return {
    success: true,
    cash: player.cash,
    debt: player.debt,
  };
};

// Repay loans
module.exports.repayLoan = async function repayLoan(userId, guildId, amount) {
  const player = await Player.findOne({userId, guildId});
  if (!player || player.cash < amount) return false; // Handle insufficient funds or player not found

  player.debt -= amount;
  player.cash -= amount;
  if (player.debt < 0) {
    player.cash += Math.abs(player.debt); // If they overpay, return the extra to cash
    player.debt = 0;
  }

  await player.save();
  return {
    success: true,
    cash: player.cash,
    debt: player.debt,
  };
};

// Currency Transfers

// Give cash to another player
module.exports.giveCash = async function giveCash(
  fromUserId,
  toUserId,
  guildId,
  amount
) {
  const fromPlayer = await Player.findOne({userId: fromUserId, guildId});
  const toPlayer = await Player.findOne({userId: toUserId, guildId});

  if (!fromPlayer || !toPlayer || fromPlayer.cash < amount || amount <= 0)
    return false; // Handle errors or insufficient funds

  fromPlayer.cash -= amount;
  toPlayer.cash += amount;

  await fromPlayer.save();
  await toPlayer.save();

  return true;
};

// Steal Cash from Another User
module.exports.stealCash = async function stealCash(
  userId,
  targetUserId,
  guildId
) {
  const player = await Player.findOne({userId, guildId});
  const target = await Player.findOne({userId: targetUserId, guildId});

  if (!player || !target) return null; // Handle players not found

  const successRate = 0.1; // 10% success rate
  const successful = Math.random() < successRate;

  if (successful) {
    const amountToSteal = Math.floor(Math.random() * target.cash * 0.1); // Steal up to 10% of target's cash
    player.cash += amountToSteal;
    target.cash -= amountToSteal;

    await player.save();
    await target.save();
  }

  return successful; // Return whether the steal was successful or not
};

// Games & Betting

// Coin Flip Game
module.exports.coinflip = async function coinflip(
  userId,
  guildId,
  choice,
  betAmount
) {
  const player = await Player.findOne({userId, guildId});
  if (!player || player.cash < betAmount) return null; // Handle insufficient funds or player not found

  const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
  if (outcome === choice) {
    player.cash += betAmount; // Player wins the bet
  } else {
    player.cash -= betAmount; // Player loses the bet
  }

  await player.save();
  return outcome; // Return the outcome so you can inform the player
};

// Economy Leaderboard & Rankings

module.exports.getCashLeaderboard = async function getCashLeaderboard(
  guildId,
  topN = 10
) {
  const players = await Player.find({guildId})
    .sort({cash: -1})
    .limit(topN)
    .select('userId cash -_id');
  return players;
};

module.exports.getBankLeaderboard = async function getBankLeaderboard(
  guildId,
  topN = 10
) {
  const players = await Player.find({guildId})
    .sort({bank: -1})
    .limit(topN)
    .select('userId bank -_id');
  return players;
};

// Daily & Periodic Bonuses
