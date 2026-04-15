const Player = require('../../../models/Player');

module.exports = async function airdrop(interaction) {
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;
  const channelMembers = interaction.channel?.members;

  if (amount <= 0) {
    return { success: false, error: 'Amount must be a positive value.' };
  }

  if (!channelMembers || typeof channelMembers.values !== 'function') {
    return {
      success: false,
      error:
        'Airdrop can only be used in a channel with visible active members.',
    };
  }

  try {
    const activeUserIds = [...channelMembers.values()]
      .filter((member) => !member.user.bot)
      .map((member) => member.user.id);

    if (activeUserIds.length === 0) {
      return {
        success: false,
        error: 'No active members were found in the current channel.',
      };
    }

    const players = await Player.find({
      guildId,
      userId: { $in: activeUserIds },
    });

    if (players.length === 0) {
      return {
        success: false,
        error:
          'No active members in the current channel have economy profiles yet.',
      };
    }

    let recipientCount = 0;
    let skippedCount = 0;

    for (const player of players) {
      if (!Number.isFinite(player.cash) || player.cash < 0) {
        skippedCount += 1;
        continue;
      }

      const updateResult = await player.updateCash(amount);
      if (!updateResult.success) {
        skippedCount += 1;
        continue;
      }

      recipientCount += 1;
    }

    return {
      success: true,
      amount,
      total: recipientCount * amount,
      recipientCount,
      skippedCount,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
