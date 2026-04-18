const Player = require('../../models/Player');

async function findPlayer(userId, guildId) {
  if (!userId || !guildId) {
    return null;
  }

  return Player.findOne({ userId, guildId });
}

async function findPlayersByUserIds(userIds, guildId) {
  if (!Array.isArray(userIds) || userIds.length === 0 || !guildId) {
    return [];
  }

  return Player.find({
    guildId,
    userId: { $in: userIds },
  });
}

async function updatePlayerValuesById(userId, guildId, values) {
  const player = await findPlayer(userId, guildId);

  if (!player) {
    return { success: false, error: 'User not found.' };
  }

  return updatePlayerValues(player, values);
}

async function updatePlayerValues(player, values) {
  if (!player) {
    return { success: false, error: 'Player not found.' };
  }

  return player.setValues(values);
}

module.exports = {
  findPlayer,
  findPlayersByUserIds,
  updatePlayerValues,
  updatePlayerValuesById,
};
