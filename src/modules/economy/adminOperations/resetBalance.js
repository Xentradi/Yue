const Player = require('../../../models/Player');

module.exports = async function resetBalance(interaction) {
  const user = interaction.options.getUser('user');
  const userId = user.id;
  const guildId = interaction.guildId;

  try {
    const player = await Player.findOne({userId, guildId});

    if (!player) return {success: false, error: 'User not found.'};

    player.cash = 0;
    player.bank = 0;
    player.debt = 0;
    await player.save();

    return {
      success: true,
      userId,
    };
  } catch (error) {
    return {success: false, error: error.message};
  }
};
