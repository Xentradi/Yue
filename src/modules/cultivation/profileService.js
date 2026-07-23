const {
  getFullCharacterProfileByPlayerId,
  findPlayerByDiscordUserId,
} = require('../../storage/cultivationRepository');
const {
  calculateDerivedCharacterStats,
} = require('./derivedStatsService');

async function getFullCharacterProfile(input, options = {}) {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    return await buildProfileForPlayerId(input, options);
  }

  if (typeof input !== 'object') {
    return null;
  }

  if (input.playerId) {
    return await buildProfileForPlayerId(input.playerId, options);
  }

  if (input.discordUserId) {
    const player = await findPlayerByDiscordUserId(input.discordUserId, options);
    if (!player) {
      return null;
    }

    return await buildProfileForPlayerId(player.id, options);
  }

  return null;
}

async function buildProfileForPlayerId(playerId, options = {}) {
  const profile = await getFullCharacterProfileByPlayerId(playerId, options);
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    derived: calculateDerivedCharacterStats(profile),
  };
}

module.exports = {
  buildProfileForPlayerId,
  getFullCharacterProfile,
};
