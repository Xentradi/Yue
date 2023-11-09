/**
 * @fileoverview Player schema module.
 * @module playerSchema
 * @requires mongoose
 * @requires statsSchema
 */

const {Schema} = require('mongoose');
const statsSchema = require('./statsSchema');

/**
 * @typedef {Object} Player
 * @property {string} userId - The user's unique identifier.
 * @property {string} guildId - The guild's unique identifier the player belongs to.
 * @property {number} exp - The player's experience points.
 * @property {number} level - The player's level.
 * @property {number} cash - The player's cash.
 * @property {number} bank - The player's bank balance.
 * @property {number} debt - The player's debt.
 * @property {number} reputation - The player's reputation.
 * @property {number} relationship - The player's relationship status.
 * @property {number} expMultiplier - Multiplier for experience points.
 * @property {number} cashMultiplier - Multiplier for cash.
 * @property {number} interestMultiplier - Multiplier for interest rates.
 * @property {Object} stats - The player's stats.
 */
const playerSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  exp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 0,
  },
  cash: {
    type: Number,
    default: 0,
  },
  bank: {
    type: Number,
    default: 0,
  },
  debt: {
    type: Number,
    default: 0,
  },
  reputation: {
    type: Number,
    default: 0,
  },
  relationship: {
    type: Number,
    default: 0,
  },
  expMultiplier: {
    type: Number,
    default: 1,
  },
  cashMultiplier: {
    type: Number,
    default: 1,
  },
  interestMultiplier: {
    type: Number,
    default: 1,
  },
  lastDailyBonusClaim: {
    type: Date,
    default: null,
  },
  stats: {
    type: statsSchema,
    default: {},
  },
});

playerSchema.index({userId: 1, guildId: 1});

/**
 * Updates the player's cash by a specified amount.
 * @async
 * @function updateCash
 * @param {number} amount - The amount to update the cash by.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('updateCash', async function (amount) {
  if (amount < 0 && Math.abs(amount) > this.cash) {
    return {success: false, error: 'Insufficient funds.'};
  }
  this.cash += amount;
  await this.save();
  return {success: true, newBalance: this.cash};
});

/**
 * Updates the player's experience points by a specified amount.
 * @async
 * @function updateExp
 * @param {number} amount - The amount to update the experience points by.
 * @returns {Promise<Object>} An object indicating success and the new experience points.
 */
playerSchema.method('updateExp', async function (amount) {
  this.exp += amount;
  await this.save();
  return {success: true, newExp: this.exp};
});

/**
 * Sets the player's cash to a specified amount.
 * @async
 * @function setCash
 * @param {number} amount - The amount to set the cash to.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('setCash', async function (amount) {
  if (amount < 0) {
    return {success: false, error: 'Amount must be a positive value.'};
  }
  this.cash = amount;
  await this.save();
  return {success: true, newBalance: this.cash};
});

/**
 * Sets the player's experience points to a specified amount.
 * @async
 * @function setExp
 * @param {number} amount - The amount to set the experience points to.
 * @returns {Promise<Object>} An object indicating success and the new experience points or an error message.
 */
playerSchema.method('setExp', async amount => {
  if (amount < 0) {
    return {success: false, error: 'Amount must be a positive value.'};
  }
  this.exp = amount;
  await this.save();
  return {success: true, newBalance: this.cash};
});

/**
 * Sets the player's values based on a provided values object.
 * @async
 * @function setValues
 * @param {Object} values - An object containing the values to update.
 * @returns {Promise<Object>} An object indicating success and the updated player.
 */
playerSchema.method('setValues', async function (values) {
  Object.assign(this, values);
  await this.save();
  return {success: true, updatedPlayer: this};
});

/**
 * Checks if the player has enough cash for a specified amount.
 * @function hasEnoughCash
 * @param {number} amount - The amount to check against.
 * @returns {boolean} True if the player has enough cash, false otherwise.
 */
playerSchema.method('hasEnoughCash', function (amount) {
  return this.cash >= amount;
});

/**
 * Transfers currency from one player to another.
 * @async
 * @function transferCurrency
 * @static
 * @param {string} playerAId - The ID of the player transferring currency.
 * @param {string} playerBId - The ID of the player receiving currency.
 * @param {number} amount - The amount of currency to transfer.
 * @returns {Promise<Object>} An object indicating success and the updated player documents or an error message.
 */
playerSchema.statics.transferCurrency = async function (
  playerAId,
  playerBId,
  amount
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const opts = {session, new: true}; // new: true to return the updated document
    const playerA = await this.findByIdAndUpdate(
      playerAId,
      {$inc: {cash: -amount}},
      opts
    );
    const playerB = await this.findByIdAndUpdate(
      playerBId,
      {$inc: {cash: amount}},
      opts
    );

    if (playerA.cash < 0) {
      // Insufficient funds check
      throw new Error('Insufficient funds');
    }

    await session.commitTransaction();
    session.endSession();
    return {success: true, playerA, playerB};
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error; // Propagate the error to be handled by calling function
  }
};

/**
 * Retrieves a player document by ID.
 * @async
 * @function getPlayer
 * @static
 * @param {string} playerId - The ID of the player to retrieve.
 * @returns {Promise<Object>} The player document.
 */
playerSchema.statics.getPlayer = async function (playerId) {
  return await this.findById(playerId);
};

/**
 * Retrieves all player documents within a specified guild.
 * @async
 * @function getPlayersByGuild
 * @static
 * @param {string} guildId - The ID of the guild to retrieve players from.
 * @returns {Promise<Array>} An array of player documents.
 */
playerSchema.statics.getPlayersByGuild = async function (guildId) {
  return await this.find({guildId});
};

/**
 * Retrieves the top players sorted by cash, up to a specified limit.
 * @async
 * @function getTopPlayersByCash
 * @static
 * @param {number} [limit=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of player documents.
 */
playerSchema.statics.getTopPlayersByCash = async function (limit = 10) {
  return await this.find().sort({cash: -1}).limit(limit);
};

/**
 * Retrieves the top players sorted by debt , up to a specified limit.
 * @async
 * @function getTopPlayersByDebt
 * @static
 * @param {number} [limit=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of player documents.
 */
playerSchema.statics.getTopPlayersByDebt = async function (limit = 10) {
  return await this.find().sort({debt: -1}).limit(limit);
};

/**
 * Retrieves the top players sorted by level, up to a specified limit.
 * @async
 * @function getTopPlayersByLevel
 * @static
 * @param {number} [limit=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of player documents.
 */
playerSchema.statics.getTopPlayersByLevel = async function (limit = 10) {
  return await this.find().sort({level: -1}).limit(limit);
};

/**
 * Retrieves the top players sorted by experience points, up to a specified limit.
 * @async
 * @function getTopPlayersByExp
 * @static
 * @param {number} [limit=10] - The number of top players to retrieve.
 * @returns {Promise<Array>} An array of player documents.
 */
playerSchema.statics.getTopPlayersByExp = async function (limit = 10) {
  return await this.find().sort({level: -1, exp: -1}).limit(limit);
};

/**
 * Retrieves the total currency (cash + bank) for a specified guild.
 * @async
 * @function getTotalCurrencyByGuild
 * @static
 * @param {string} guildId - The ID of the guild to retrieve total currency from.
 * @returns {Promise<number>} The total currency of the guild.
 */
playerSchema.statics.getTotalCurrencyByGuild = async function (guildId) {
  const result = await this.aggregate([
    {$match: {guildId: guildId}},
    {
      $group: {
        _id: null,
        totalCash: {$sum: '$cash'},
        totalBank: {$sum: '$bank'},
      },
    },
    {$project: {totalCurrency: {$add: ['$totalCash', '$totalBank']}}},
  ]);
  return result[0] ? result[0].totalCurrency : 0;
};

/**
 * Compares a given net worth value against the top 10 players' net worth within a specific guild.
 * @async
 * @function compareNetWorthToTopInGuild
 * @static
 * @param {number} netWorth - The net worth value to compare.
 * @param {string} guildId - The guild's unique identifier to constrain the top 10 players.
 * @returns {Promise<Object>} An object with comparison data.
 */
playerSchema.statics.compareNetWorthToTopInGuild = async function (
  netWorth,
  guildId
) {
  // Retrieve the top 10 players by net worth within the specific guild
  const topPlayers = await this.find({guildId: guildId})
    .sort({cash: -1, bank: -1})
    .limit(30)
    .lean();

  // Calculate the total net worth of the top 10 players in the guild
  const totalTopNetWorth = topPlayers.reduce(
    (acc, player) => acc + player.cash + player.bank,
    0
  );

  // Determine where the given net worth stands in comparison to the top 10 players
  const sortedNetWorths = topPlayers
    .map(player => player.cash + player.bank)
    .concat(netWorth)
    .sort((a, b) => b - a);
  const rank = sortedNetWorths.indexOf(netWorth) + 1; // Add 1 to get the 1-based rank

  // Calculate the percentage of the total top net worth that the given net worth represents
  const percentageOfTop = (netWorth / totalTopNetWorth) * 100;

  // Check if the given net worth is in the top 30
  const isInTop = rank <= 30;

  // Return the comparison data
  return {
    isInTop,
    rank,
    percentageOfTop,
    totalTopNetWorth,
  };
};

module.exports = {playerSchema};
