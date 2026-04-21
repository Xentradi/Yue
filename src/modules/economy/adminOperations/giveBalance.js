const {
  ensurePlayer,
  findPlayer,
  updatePlayerValues,
} = require('../playerService');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

const ALLOWED_FIELDS = new Set(['cash', 'bank', 'debt']);

module.exports = async function giveBalance(interaction) {
  const user = interaction.options.getUser('user');
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const userId = user.id;
  const guildId = interaction.guildId;
  const field = interaction.options.getString('field');
  const amount = interaction.options.getInteger('amount');

  if (!ALLOWED_FIELDS.has(field)) {
    return { success: false, error: 'Invalid balance field.' };
  }

  if (!Number.isInteger(amount) || amount < 0) {
    return { success: false, error: 'Amount must be a non-negative integer.' };
  }

  try {
    const result = await withTransaction(async (client) => {
      await ensurePlayer(userId, guildId, { client });
      const player = await findPlayer(userId, guildId, { client, lock: true });

      if (!Number.isFinite(player[field]) || player[field] < 0) {
        return {
          success: false,
          error: `Current ${field} balance is invalid.`,
        };
      }

      const nextAmount =
        field === 'debt'
          ? Math.max(player.debt - amount, 0)
          : player[field] + amount;
      const updateResult = await updatePlayerValues(
        player,
        {
          [field]: nextAmount,
        },
        { client },
      );
      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      return {
        success: true,
        userId,
        field,
        newAmount: nextAmount,
      };
    });

    if (result.success) {
      await Promise.all([
        bumpVersion('player', guildId),
        bumpVersion('leaderboard', guildId),
        bumpVersion('tracked'),
      ]);
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};
