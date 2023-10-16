const Player = require('../../../models/Player');

module.exports = async function airdrop(interaction) {
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;

  if (amount < 0)
    return {success: false, error: 'Amount must be a positive value.'};

  try {
    const players = await Player.find({guildId});

    for (const player of players) {
      player.cash += amount;
      await player.save();
    }

    return {
      success: true,
      amount,
      total: players.length * amount,
    };
  } catch (error) {
    return {success: false, error: error.message};
  }
};
