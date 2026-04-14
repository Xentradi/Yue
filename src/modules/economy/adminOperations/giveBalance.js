const Player = require('../../../models/Player');

const ALLOWED_FIELDS = new Set(['cash', 'bank', 'debt']);

module.exports = async function giveBalance(interaction) {
  const user = interaction.options.getUser('user');
  const userId = user.id;
  const guildId = interaction.guildId;
  const field = interaction.options.getString('field');
  const amount = interaction.options.getInteger('amount');

  if (!ALLOWED_FIELDS.has(field)) {
    return { success: false, error: 'Invalid balance field.' };
  }

  if (amount < 0) {
    return { success: false, error: 'Amount must be a positive value.' };
  }

  try {
    const player = await Player.findOne({ userId, guildId });

    if (!player) return { success: false, error: 'User not found.' };

    if (field === 'debt') {
      player.debt = Math.max(player.debt - amount, 0);
    } else {
      player[field] += amount;
    }

    await player.save();

    return {
      success: true,
      userId,
      field,
      newAmount: player[field],
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
