const { createPlayerRecord, findPlayerByDiscordUserId } = require('../../storage/cultivationRepository');

async function ensurePlayerByDiscordUserId(discordUserId, options = {}) {
  const normalizedDiscordUserId =
    typeof discordUserId === 'string' ? discordUserId.trim() : '';

  if (!normalizedDiscordUserId) {
    return null;
  }

  const existing = await findPlayerByDiscordUserId(normalizedDiscordUserId, options);
  if (existing) {
    return existing;
  }

  return await createPlayerRecord({ discordUserId: normalizedDiscordUserId }, options);
}

module.exports = {
  ensurePlayerByDiscordUserId,
  findPlayerByDiscordUserId,
};
