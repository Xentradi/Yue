const Player = require('../../../models/Player');

module.exports = async function getBalance(interaction) {
  const user = interaction.options.getUser('user');
  const userId = user.id;
  const guildId = interaction.guildId;

  try {
    const player = await Player.findOne({userId, guildId});

    if (!player) return {success: false, error: 'User not found.'};

    return {
      success: true,
      userId,
      cash: player.cash,
      bank: player.bank,
      debt: player.debt,
    };
  } catch (error) {
    return {success: false, error: error.message};
  }
};
