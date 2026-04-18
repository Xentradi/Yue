const logger = require('../../../utils/logger');
const Player = require('../../../models/Player');

module.exports = async function getBalance(interaction) {
  const user = interaction.options.getUser('user');
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const userId = user.id;
  const guildId = interaction.guildId;

  try {
    logger.debug(`UserId: ${userId}`);
    logger.debug(`GuildId: ${guildId}`);
    const player = await Player.findOne({ userId, guildId })
      .select('cash bank debt -_id')
      .lean();
    logger.debug(`Player: ${player}`);

    if (!player) return { success: false, error: 'User not found.' };

    return {
      success: true,
      userId,
      cash: player.cash,
      bank: player.bank,
      debt: player.debt,
    };
  } catch (error) {
    logger.error(`An error occurred retrieving the player balance: ${error}`);
    return { success: false, error: error.message };
  }
};
