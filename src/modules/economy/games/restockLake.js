const Lake = require('../../../models/Lake'); // Make sure to adjust the path as necessary

/**
 * Restocks the lake with the default fish and other items.
 *
 * @async
 * @function
 * @param {string} guildId - The ID of the guild (server).
 * @param {number} [size=1000] - The number of total items to stock in the lake.
 * @returns {Promise<Object>} The result and status of the restock operation.
 * @throws Will log an error if saving to the database fails.
 */
module.exports = async function restockLake(guildId, size = 1000) {
  const fishingOutcomes = [
    {type: 'Tilapia', reward: 10, rarity: 20},
    {type: 'Salmon', reward: 10, rarity: 20},
    {type: 'Golden Trout', reward: 10, rarity: 20},
    {type: 'Magic Koi', reward: 15, rarity: 5},
    {type: 'Silverfin Tuna', reward: 50, rarity: 10},
    {type: 'Neon Tetra', reward: 50, rarity: 5},
    {type: 'Dragonfish', reward: 100, rarity: 1},
    {type: 'Hostile Crab', reward: -20, rarity: 13},
    {type: 'Angry Lobster', reward: -25, rarity: 4},
    {type: 'Line Broke', reward: -10, rarity: 2},
  ];

  // Compute the total for each fish type based on its rarity and lake size
  const fishStock = fishingOutcomes.map(fish => {
    return {
      type: fish.type,
      count: Math.floor(size * (fish.rarity / 100)),
      reward: fish.reward,
    };
  });

  let lake = await Lake.findOne({guildId});

  if (!lake) {
    lake = new Lake({guildId, fishStock});
  } else {
    lake.fishStock = fishStock;
  }

  try {
    await lake.save();
    return {
      success: true,
      newFishCount: size,
      message: 'Lake restocked successfully!',
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: 'An error occurred while restocking the lake.',
    };
  }
};
