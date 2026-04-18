const { findPlayer, updatePlayerValues } = require('../playerService');

module.exports = async function resetBalance(interaction) {
  const user = interaction.options.getUser('user');
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const userId = user.id;
  const guildId = interaction.guildId;

  try {
    const player = await findPlayer(userId, guildId);

    if (!player) return { success: false, error: 'User not found.' };

    const updateResult = await updatePlayerValues(player, {
      cash: 0,
      bank: 0,
      debt: 0,
    });
    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return {
      success: true,
      userId,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
