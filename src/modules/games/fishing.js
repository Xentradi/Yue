const Lake = require('../../models/Lake');
const balance = require('../economy/balance');
const { withTransaction } = require('../../storage/postgres');
const { bumpVersion } = require('../../storage/cache');
const logger = require('../../utils/logger');
const { findPlayer } = require('../economy/playerService');

/**
 * Allow a player to fish in the lake and get rewarded based on the fish they catch.
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @returns {Promise<Object>} An object containing the fishing result and status of operation.
 */

module.exports = async function fish(userId, guildId) {
  try {
    const result = await withTransaction(async (client) => {
      const player = await findPlayer(userId, guildId, { client, lock: true });
      const lake = await Lake.findOne({ guildId }, { client, lock: true });

      if (!player) {
        return {
          success: false,
          description: 'Player not found in the database.',
        };
      }

      if (!lake || !lakeHasFish(lake)) {
        return {
          success: false,
          description: 'The pond has been depleted! Come back later.',
        };
      }

      const outcome = selectFishFromLake(lake);
      if (!outcome) {
        return {
          success: false,
          description: 'The pond has been depleted! Come back later.',
        };
      }

      const updateCashResult = await balance.updatePlayerCash(
        player,
        outcome.reward,
        { client },
      );

      if (!updateCashResult.success) {
        throw new Error(updateCashResult.message);
      }

      await lake.save({ client });

      return {
        success: true,
        type: outcome.type,
        reward: outcome.reward,
        playerCash: player.cash,
        playerBank: player.bank,
        playerDebt: player.debt,
        description: `You cast your line and caught a ${outcome.type}!`,
        message:
          outcome.reward >= 0
            ? `You earned $${outcome.reward}.`
            : `You lost $${Math.abs(outcome.reward)}.`,
      };
    });

    if (result.success) {
      await Promise.all([
        bumpVersion('player', guildId),
        bumpVersion('leaderboard', guildId),
        bumpVersion('lake', guildId),
        bumpVersion('tracked'),
      ]);
    }

    return result;
  } catch (err) {
    logger.error(
      `An error occurred while processing the fishing attempt: ${err}`,
    );
    return {
      success: false,
      description: 'An error occurred while processing the fishing attempt.',
    };
  }
};

/**
 * Checks if there are any fish left in the lake.
 * @function
 * @param {Lake} lake - The lake model instance.
 * @returns {boolean} True if there's at least one fish left, false otherwise.
 */
function lakeHasFish(lake) {
  return lake.fishStock.some((fish) => fish.count > 0);
}

/**
 * Selects a fish from the lake based on its availability and rarity.
 * @function
 * @param {Lake} lake - The lake model instance.
 * @returns {Fish} The type of fish caught.
 */
function selectFishFromLake(lake) {
  const weightedFishes = lake.fishStock.flatMap((fish) =>
    Array(fish.count).fill(fish),
  );

  if (weightedFishes.length === 0) return null;

  const randomFish =
    weightedFishes[Math.floor(Math.random() * weightedFishes.length)];

  const fishInLake = lake.fishStock.find((f) => f.type === randomFish.type);
  fishInLake.count -= 1;

  return randomFish;
}
