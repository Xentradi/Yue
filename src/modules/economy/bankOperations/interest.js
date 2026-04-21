const logger = require('../../../utils/logger');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

/**
 * Applies a variable interest rate to all player's bank balances and debt within a specific guild.
 * The bank interest rate varies between 0.1% to 0.3%, and the debt interest rate varies between 0.2% to 0.5%.
 *
 * @async
 * @function
 * @param {string} [guildId] - The ID of the guild to update. If omitted, all players are updated.
 * @returns {Promise<Object>} An object containing the operation status and message.
 * @throws Will log an error if there's an issue with database access.
 */
module.exports = async function applyBankInterest(guildId) {
  try {
    const result = await withTransaction(async (client) => {
      const countResult = await countInterestTargets(client, guildId);
      if (countResult.totalCount === 0) {
        return {
          success: false,
          message: 'No players found.',
        };
      }

      // Randomly generate bank and debt interest rates
      const baseBankInterestRate = 0.001 + Math.random() * 0.002; // 0.1% to 0.3%
      const debtInterestRate = 0.002 + Math.random() * 0.003; // 0.2% to 0.5%
      const { rows } = await client.query(
        `
          UPDATE players
          SET bank = CASE
                WHEN bank > 1000 THEN bank + ROUND(bank::numeric * $1 * interest_multiplier)::bigint
                ELSE bank
              END,
              debt = CASE
                WHEN debt > 0 THEN debt + ROUND(debt::numeric * $2)::bigint
                ELSE debt
              END,
              updated_at = NOW()
          ${
            guildId
              ? `WHERE guild_id = $3
                 AND bank >= 0
                 AND debt >= 0
                 AND interest_multiplier >= 0`
              : 'WHERE bank >= 0 AND debt >= 0 AND interest_multiplier >= 0'
          }
          RETURNING guild_id;
        `,
        guildId
          ? [baseBankInterestRate, debtInterestRate, guildId]
          : [baseBankInterestRate, debtInterestRate],
      );

      return {
        success: true,
        message: `Bank and debt interests successfully applied for ${rows.length} player(s). Skipped ${
          countResult.skippedCount
        } invalid record(s).`,
        updatedCount: rows.length,
        skippedCount: countResult.skippedCount,
        touchedGuildIds: [
          ...new Set(rows.map((row) => row.guild_id).filter(Boolean)),
        ],
      };
    });

    if (result.success) {
      await Promise.all([
        bumpVersion('tracked'),
        ...(result.touchedGuildIds ?? []).flatMap((id) => [
          bumpVersion('player', id),
          bumpVersion('leaderboard', id),
        ]),
      ]);
    }

    return result;
  } catch (error) {
    logger.error(`An error occurred while fetching players: ${error}`);
    return {
      success: false,
      message: 'Database error.',
    };
  }
};

async function countInterestTargets(client, guildId) {
  const { rows } = await client.query(
    `
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (
          WHERE bank >= 0
            AND debt >= 0
            AND interest_multiplier >= 0
        )::int AS valid_count
      FROM players
      ${guildId ? 'WHERE guild_id = $1' : ''}
    `,
    guildId ? [guildId] : [],
  );

  const row = rows[0] ?? { total_count: 0, valid_count: 0 };
  return {
    totalCount: row.total_count ?? 0,
    validCount: row.valid_count ?? 0,
    skippedCount: Math.max((row.total_count ?? 0) - (row.valid_count ?? 0), 0),
  };
}
