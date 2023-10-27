const Player = require('../../models/Player');
const Lake = require('../../models/Lake');
const balance = require('../economy/balance');
const logger = require('../../utils/logger');

/**
 * Allow a player to fish in the lake and get rewarded based on the fish they catch.
 * @async
 * @function
 * @param {string} userId - The ID of the user.
 * @param {string} guildId - The ID of the guild (server).
 * @returns {Promise<Object>} An object containing the fishing result and status of operation.
 */

module.exports = async function fish(userId, guildId) {
  const player = await Player.findOne({userId, guildId});
  const lake = await Lake.findOne({guildId});

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

  // Use the updatePlayerCash function to handle cash updates
  const updateCashResult = await balance.updatePlayerCash(
    player,
    outcome.reward
  );

  if (!updateCashResult.success) {
    return {
      success: false,
      description: updateCashResult.message, // Using the error message from updatePlayerCash
    };
  }

  try {
    await lake.save();

    return {
      success: true,
      type: outcome.type, // Include the type of fish caught in the return object
      reward: outcome.reward,
      description: `You cast your line and caught a ${outcome.type}!`,
      message:
        outcome.reward >= 0
          ? `You earned $${outcome.reward}.`
          : `You lost $${Math.abs(outcome.reward)}.`,
    };
  } catch (err) {
    logger.error(
      `An error occured while processing the fishing attempt: ${err}`
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
  return lake.fishStock.some(fish => fish.count > 0);
}

/**
 * Selects a fish from the lake based on its availability and rarity.
 * @function
 * @param {Lake} lake - The lake model instance.
 * @returns {Fish} The type of fish caught.
 */
function selectFishFromLake(lake) {
  // Convert the fish array into a weighted array
  const weightedFishes = lake.fishStock.flatMap(fish =>
    Array(fish.count).fill(fish)
  );

  if (weightedFishes.length === 0) return null;

  // Select a random fish from the weighted array
  const randomFish =
    weightedFishes[Math.floor(Math.random() * weightedFishes.length)];

  // Decrement the fish count in the lake
  const fishInLake = lake.fishStock.find(f => f.type === randomFish.type);
  fishInLake.count -= 1;

  return randomFish;
}
