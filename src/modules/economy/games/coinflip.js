const Player = require('../../../models/Player');

module.exports = async function coinFlip(userId, guildId, choice, betAmount) {
  const player = await Player.findOne({userId, guildId});

  const result = {
    success: false,
    outcome: Math.random() < 0.5 ? 'heads' : 'tails',
    playerChoice: choice,
    betAmount,
    win: false,
    prize: 0,
    playerBalanceBefore: player?.cash || 0,
    playerBalanceAfter: player?.cash || 0,
  };

  if (!player) {
    result.message = 'Player not found in the database.';
    return result;
  }

  if (player.cash < betAmount) {
    result.message = 'Insufficient funds to place the bet.';
    return result;
  }

  if (result.outcome === choice) {
    player.cash += betAmount;
    result.win = true;
    result.prize = betAmount;
  } else {
    player.cash -= betAmount;
    result.prize = -betAmount;
  }

  result.playerBalanceAfter = player.cash;

  try {
    await player.save();
    result.success = true;
  } catch (err) {
    console.error(err);
    result.message = 'An error occurred while processing the bet.';
  }

  return result;
};
