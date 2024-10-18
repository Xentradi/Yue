const BankService = require('../../../services/BankService');

module.exports = async function giveBalance(interaction) {
  const user = interaction.options.getUser('user');
  const userId = user.id;
  const guildId = interaction.guildId;
  const field = interaction.options.getString('field');
  const amount = interaction.options.getInteger('amount');

  if (amount < 0)
    return {success: false, error: 'Amount must be a positive value.'};

  try {
    const player = await Player.findOne({userId, guildId});

    if (!player) return {success: false, error: 'User not found.'};

    player[field] += amount;
    await player.save();

    return {
      success: true,
      userId,
      field,
      newAmount: player[field],
    };
  } catch (error) {
    return {success: false, error: error.message};
  }
};
