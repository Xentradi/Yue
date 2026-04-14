const Player = require('../../../models/Player');

const ALLOWED_FIELDS = new Set(['cash', 'bank', 'debt']);

module.exports = async function setBalance(interaction) {
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
    const player = await Player.findOneAndUpdate(
      { userId, guildId },
      { $set: { [field]: amount } },
      { returnDocument: 'after' },
    );

    if (!player) return { success: false, error: 'User not found.' };

    return {
      success: true,
      userId,
      field,
      newAmount: amount,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
