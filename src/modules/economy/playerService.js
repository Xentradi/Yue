const Player = require('../../models/Player');

async function findPlayer(userId, guildId, options = {}) {
  if (!userId || !guildId) {
    return null;
  }

  return Player.findOne({ userId, guildId }, options);
}

async function ensurePlayer(userId, guildId, options = {}) {
  const player = await findPlayer(userId, guildId, options);
  if (player) {
    return player;
  }

  return await Player.ensurePlayer({ userId, guildId }, options);
}

async function ensurePlayers(records = [], options = {}) {
  return Player.ensurePlayers(records, options);
}

async function findPlayersByUserIds(userIds, guildId, options = {}) {
  if (!Array.isArray(userIds) || userIds.length === 0 || !guildId) {
    return [];
  }

  return Player.find(
    {
      guildId,
      userId: { $in: userIds },
    },
    options,
  );
}

async function findPlayersByGuild(guildId, options = {}) {
  if (!guildId) {
    return [];
  }

  return Player.find({ guildId }, options);
}

async function updatePlayerValuesById(userId, guildId, values, options = {}) {
  const player = await findPlayer(userId, guildId, options);

  if (!player) {
    return { success: false, error: 'User not found.' };
  }

  return updatePlayerValues(player, values, options);
}

async function updatePlayerValues(player, values, options = {}) {
  if (!player) {
    return { success: false, error: 'Player not found.' };
  }

  return player.setValues(values, options);
}

module.exports = {
  ensurePlayer,
  ensurePlayers,
  findPlayer,
  findPlayersByGuild,
  findPlayersByUserIds,
  updatePlayerValues,
  updatePlayerValuesById,
};
