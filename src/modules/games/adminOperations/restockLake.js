const Lake = require('../../../models/Lake');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');
const logger = require('../../../utils/logger');

/**
 * Restocks the lake with the default fish and other items.
 *
 * @async
 * @function
 * @param {string} lakeId - The ID of the lake entity.
 * @param {number} [size=1000] - The number of total items to stock in the lake.
 * @param {Object} [options={}] - Optional lake metadata overrides.
 * @returns {Promise<Object>} The result and status of the restock operation.
 * @throws Will log an error if saving to the database fails.
 */
module.exports = async function restockLake(lakeId, size = 1000, options = {}) {
  if (!lakeId) {
    return {
      success: false,
      message: 'Lake ID is required to restock a lake.',
    };
  }

  if (!Number.isFinite(size) || size <= 0) {
    return {
      success: false,
      message: 'Lake size must be a positive number.',
    };
  }

  const fishingOutcomes = [
    { type: 'Tilapia', reward: 10, rarity: 20 },
    { type: 'Salmon', reward: 10, rarity: 20 },
    { type: 'Golden Trout', reward: 10, rarity: 20 },
    { type: 'Magic Koi', reward: 15, rarity: 5 },
    { type: 'Silverfin Tuna', reward: 50, rarity: 10 },
    { type: 'Neon Tetra', reward: 50, rarity: 5 },
    { type: 'Dragonfish', reward: 100, rarity: 1 },
    { type: 'Hostile Crab', reward: -20, rarity: 13 },
    { type: 'Angry Lobster', reward: -25, rarity: 4 },
    { type: 'Line Broke', reward: -10, rarity: 2 },
  ];

  // Compute the total for each fish type based on its rarity and lake size
  const fishStock = fishingOutcomes.map((fish) => {
    return {
      type: fish.type,
      count: Math.floor(size * (fish.rarity / 100)),
      reward: fish.reward,
    };
  });

  try {
    const result = await withTransaction(async (client) => {
      let lake = await Lake.findOne(
        { guildId: lakeId },
        { client, lock: true },
      );

      if (!lake) {
        lake = new Lake({
          guildId: lakeId,
          ownershipType: options.ownershipType ?? 'public',
          fishStock,
          lastStocked: new Date(),
        });
      } else {
        lake.fishStock = fishStock;
        lake.lastStocked = new Date();
      }

      await lake.save({ client });

      const totalFishCount = fishStock.reduce(
        (total, fish) => total + fish.count,
        0,
      );
      return {
        success: true,
        newFishCount: totalFishCount,
        speciesCount: fishStock.length,
        message: `Lake restocked with ${totalFishCount.toLocaleString()} fish across ${fishStock.length} species.`,
      };
    });

    if (result.success) {
      await Promise.all([bumpVersion('lake', lakeId), bumpVersion('tracked')]);
    }

    return result;
  } catch (err) {
    logger.error(`An error occurred while restocking the lake: ${err}`);
    return {
      success: false,
      message: 'An error occurred while restocking the lake.',
    };
  }
};
