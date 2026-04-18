/**
 * @fileoverview Player schema module.
 * @module playerSchema
 * @requires mongoose
 * @requires statsSchema
 */

const { Schema } = require('mongoose');
const statsSchema = require('./statsSchema');

const BALANCE_FIELDS = new Set([
  'cash',
  'bank',
  'debt',
  'exp',
  'level',
  'reputation',
  'relationship',
  'expMultiplier',
  'cashMultiplier',
  'interestMultiplier',
]);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value) {
  return isFiniteNumber(value) && value >= 0;
}

function snapshotFields(doc, fields) {
  return fields.reduce((snapshot, field) => {
    snapshot[field] = doc[field];
    return snapshot;
  }, {});
}

function restoreFields(doc, snapshot) {
  Object.assign(doc, snapshot);
}

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
    min: 0,
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
  },
  cash: {
    type: Number,
    default: 0,
    min: 0,
  },
  bank: {
    type: Number,
    default: 0,
    min: 0,
  },
  debt: {
    type: Number,
    default: 0,
    min: 0,
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
    min: 0,
  },
  cashMultiplier: {
    type: Number,
    default: 1,
    min: 0,
  },
  interestMultiplier: {
    type: Number,
    default: 1,
    min: 0,
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

playerSchema.index({ userId: 1, guildId: 1 });
playerSchema.index({ guildId: 1, cash: -1 });
playerSchema.index({ guildId: 1, bank: -1 });
playerSchema.index({ guildId: 1, debt: -1 });

/**
 * Updates the player's cash by a specified amount.
 * @async
 * @function updateCash
 * @param {number} amount - The amount to update the cash by.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('updateCash', async function (amount) {
  if (!isFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a valid number.' };
  }

  if (!isFiniteNumber(this.cash) || this.cash < 0) {
    return { success: false, error: 'Player cash balance is invalid.' };
  }

  if (this.cash + amount < 0) {
    return { success: false, error: 'Insufficient funds.' };
  }

  const previousCash = this.cash;
  this.cash += amount;

  try {
    await this.save();
    return { success: true, newBalance: this.cash };
  } catch (error) {
    this.cash = previousCash;
    return { success: false, error: error.message };
  }
});

/**
 * Updates the player's bank by a specified amount.
 * @async
 * @function updateBank
 * @param {number} amount - The amount to update the bank by.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('updateBank', async function (amount) {
  if (!isFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a valid number.' };
  }

  if (!isFiniteNumber(this.bank) || this.bank < 0) {
    return { success: false, error: 'Player bank balance is invalid.' };
  }

  if (this.bank + amount < 0) {
    return { success: false, error: 'Insufficient funds.' };
  }

  const previousBank = this.bank;
  this.bank += amount;

  try {
    await this.save();
    return { success: true, newBalance: this.bank };
  } catch (error) {
    this.bank = previousBank;
    return { success: false, error: error.message };
  }
});

/**
 * Updates the player's debt by a specified amount.
 * @async
 * @function updateDebt
 * @param {number} amount - The amount to update the debt by.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('updateDebt', async function (amount) {
  if (!isFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a valid number.' };
  }

  if (!isFiniteNumber(this.debt) || this.debt < 0) {
    return { success: false, error: 'Player debt balance is invalid.' };
  }

  if (this.debt + amount < 0) {
    return { success: false, error: 'Debt cannot go below zero.' };
  }

  const previousDebt = this.debt;
  this.debt += amount;

  try {
    await this.save();
    return { success: true, newBalance: this.debt };
  } catch (error) {
    this.debt = previousDebt;
    return { success: false, error: error.message };
  }
});

/**
 * Updates the player's experience points by a specified amount.
 * @async
 * @function updateExp
 * @param {number} amount - The amount to update the experience points by.
 * @returns {Promise<Object>} An object indicating success and the new experience points.
 */
playerSchema.method('updateExp', async function (amount) {
  if (!isFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a valid number.' };
  }

  if (!isFiniteNumber(this.exp) || this.exp < 0) {
    return { success: false, error: 'Player experience is invalid.' };
  }

  if (this.exp + amount < 0) {
    return { success: false, error: 'Experience cannot go below zero.' };
  }

  const previousExp = this.exp;
  this.exp += amount;

  try {
    await this.save();
    return { success: true, newExp: this.exp };
  } catch (error) {
    this.exp = previousExp;
    return { success: false, error: error.message };
  }
});

/**
 * Sets the player's cash to a specified amount.
 * @async
 * @function setCash
 * @param {number} amount - The amount to set the cash to.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('setCash', async function (amount) {
  if (!isNonNegativeFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a positive value.' };
  }

  const previousCash = this.cash;
  this.cash = amount;

  try {
    await this.save();
    return { success: true, newBalance: this.cash };
  } catch (error) {
    this.cash = previousCash;
    return { success: false, error: error.message };
  }
});

/**
 * Sets the player's bank to a specified amount.
 * @async
 * @function setBank
 * @param {number} amount - The amount to set the bank to.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('setBank', async function (amount) {
  if (!isNonNegativeFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a positive value.' };
  }

  const previousBank = this.bank;
  this.bank = amount;

  try {
    await this.save();
    return { success: true, newBalance: this.bank };
  } catch (error) {
    this.bank = previousBank;
    return { success: false, error: error.message };
  }
});

/**
 * Sets the player's debt to a specified amount.
 * @async
 * @function setDebt
 * @param {number} amount - The amount to set the debt to.
 * @returns {Promise<Object>} An object indicating success and the new balance or an error message.
 */
playerSchema.method('setDebt', async function (amount) {
  if (!isNonNegativeFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a positive value.' };
  }

  const previousDebt = this.debt;
  this.debt = amount;

  try {
    await this.save();
    return { success: true, newBalance: this.debt };
  } catch (error) {
    this.debt = previousDebt;
    return { success: false, error: error.message };
  }
});

/**
 * Sets the player's experience points to a specified amount.
 * @async
 * @function setExp
 * @param {number} amount - The amount to set the experience points to.
 * @returns {Promise<Object>} Success state and the new experience points.
 */
playerSchema.method('setExp', async function (amount) {
  if (!isNonNegativeFiniteNumber(amount)) {
    return { success: false, error: 'Amount must be a positive value.' };
  }

  const previousExp = this.exp;
  this.exp = amount;

  try {
    await this.save();
    return { success: true, newExp: this.exp };
  } catch (error) {
    this.exp = previousExp;
    return { success: false, error: error.message };
  }
});

/**
 * Sets the player's values based on a provided values object.
 * @async
 * @function setValues
 * @param {Object} values - An object containing the values to update.
 * @returns {Promise<Object>} An object indicating success and the updated player.
 */
playerSchema.method('setValues', async function (values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return { success: false, error: 'Values must be an object.' };
  }

  for (const [field, value] of Object.entries(values)) {
    if (
      field === 'lastDailyBonusClaim' &&
      value !== null &&
      !(value instanceof Date)
    ) {
      return {
        success: false,
        error: `Invalid value for ${field}.`,
      };
    }

    if (value instanceof Date && Number.isNaN(value.getTime())) {
      return {
        success: false,
        error: `Invalid value for ${field}.`,
      };
    }

    if (BALANCE_FIELDS.has(field) && !isNonNegativeFiniteNumber(value)) {
      return {
        success: false,
        error: `Invalid value for ${field}.`,
      };
    }

    if (
      field !== 'lastDailyBonusClaim' &&
      typeof value === 'number' &&
      !isFiniteNumber(value)
    ) {
      return {
        success: false,
        error: `Invalid value for ${field}.`,
      };
    }
  }

  const snapshot = snapshotFields(this, Object.keys(values));
  Object.assign(this, values);

  try {
    await this.save();
    return { success: true, updatedPlayer: this };
  } catch (error) {
    restoreFields(this, snapshot);
    return { success: false, error: error.message };
  }
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
 * @returns {Promise<Object>} Success state and the updated player documents.
 */
playerSchema.statics.transferCurrency = async function (
  guildId,
  playerAUserId,
  playerBUserId,
  amount,
) {
  if (!guildId || !playerAUserId || !playerBUserId) {
    return { success: false, error: 'Guild and user IDs are required.' };
  }

  if (!isFiniteNumber(amount) || amount <= 0) {
    return { success: false, error: 'Invalid transfer amount.' };
  }

  try {
    const topologyType = this.db?.client?.topology?.description?.type;
    if (topologyType && topologyType !== 'Single') {
      const session = await this.db.startSession();
      try {
        let playerA;
        let playerB;

        await session.withTransaction(async () => {
          [playerA, playerB] = await loadTransferPlayers(
            this,
            guildId,
            playerAUserId,
            playerBUserId,
            session,
          );

          if (!playerA) {
            throw new Error('Sender not found.');
          }
          if (!playerB) {
            throw new Error('Recipient not found.');
          }

          const senderCash = playerA.cash;
          const recipientCash = playerB.cash;

          if (!isNonNegativeFiniteNumber(senderCash)) {
            throw new Error('Player cash balance is invalid.');
          }
          if (!isNonNegativeFiniteNumber(recipientCash)) {
            throw new Error('Recipient cash balance is invalid.');
          }
          if (senderCash < amount) {
            throw new Error('Insufficient cash.');
          }

          playerA.cash = senderCash - amount;
          playerB.cash = recipientCash + amount;

          await Promise.all([
            playerA.save({ session }),
            playerB.save({ session }),
          ]);
        });

        return {
          success: true,
          playerA,
          playerB,
          transferredAmount: amount,
        };
      } finally {
        session.endSession();
      }
    }

    return await transferCurrencyWithoutTransaction(
      this,
      guildId,
      playerAUserId,
      playerBUserId,
      amount,
    );
  } catch (error) {
    return { success: false, error: error.message };
  }
};

async function transferCurrencyWithoutTransaction(
  model,
  guildId,
  playerAUserId,
  playerBUserId,
  amount,
) {
  const [playerA, playerB] = await loadTransferPlayers(
    model,
    guildId,
    playerAUserId,
    playerBUserId,
  );

  if (!playerA) {
    return { success: false, error: 'Sender not found.' };
  }

  if (!playerB) {
    return { success: false, error: 'Recipient not found.' };
  }

  const senderCash = playerA.cash;
  const recipientCash = playerB.cash;

  if (!isNonNegativeFiniteNumber(senderCash)) {
    return { success: false, error: 'Player cash balance is invalid.' };
  }

  if (!isNonNegativeFiniteNumber(recipientCash)) {
    return { success: false, error: 'Recipient cash balance is invalid.' };
  }

  if (senderCash < amount) {
    return { success: false, error: 'Insufficient cash.' };
  }

  const senderUpdate = await model.updateOne(
    { _id: playerA._id, cash: senderCash },
    { $set: { cash: senderCash - amount } },
  );

  if (senderUpdate.modifiedCount !== 1) {
    return { success: false, error: 'Failed to update sender balance.' };
  }

  const recipientUpdate = await model.updateOne(
    { _id: playerB._id, cash: recipientCash },
    { $set: { cash: recipientCash + amount } },
  );

  if (recipientUpdate.modifiedCount !== 1) {
    await model.updateOne({ _id: playerA._id }, { $set: { cash: senderCash } });
    return { success: false, error: 'Failed to update recipient balance.' };
  }

  const [updatedSender, updatedRecipient] = await Promise.all([
    model.findById(playerA._id),
    model.findById(playerB._id),
  ]);

  return {
    success: true,
    playerA: updatedSender,
    playerB: updatedRecipient,
    transferredAmount: amount,
  };
}

async function loadTransferPlayers(
  model,
  guildId,
  playerAUserId,
  playerBUserId,
  session,
) {
  if (playerAUserId === playerBUserId) {
    return Promise.all([
      model.findOne({ userId: playerAUserId, guildId }).session(session),
      model.findOne({ userId: playerBUserId, guildId }).session(session),
    ]);
  }

  const query = {
    guildId,
    userId: { $in: [playerAUserId, playerBUserId] },
  };
  const players = session
    ? await model.find(query).session(session)
    : await model.find(query);

  return [
    players.find((player) => player.userId === playerAUserId) ?? null,
    players.find((player) => player.userId === playerBUserId) ?? null,
  ];
}

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
  return await this.find({ guildId });
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
  return await this.find().sort({ cash: -1 }).limit(limit);
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
  return await this.find().sort({ debt: -1 }).limit(limit);
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
  return await this.find().sort({ level: -1 }).limit(limit);
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
  return await this.find().sort({ level: -1, exp: -1 }).limit(limit);
};

/**
 * Retrieves the total currency (cash + bank) for a specified guild.
 * @async
 * @function getTotalCurrencyByGuild
 * @static
 * @param {string} guildId - The guild to total currency for.
 * @returns {Promise<number>} The total currency of the guild.
 */
playerSchema.statics.getTotalCurrencyByGuild = async function (guildId) {
  const result = await this.aggregate([
    { $match: { guildId: guildId } },
    {
      $group: {
        _id: null,
        totalCash: { $sum: '$cash' },
        totalBank: { $sum: '$bank' },
      },
    },
    { $project: { totalCurrency: { $add: ['$totalCash', '$totalBank'] } } },
  ]);
  return result[0] ? result[0].totalCurrency : 0;
};

/**
 * Compares a net worth value against top players in a guild.
 * @async
 * @function compareNetWorthToTopInGuild
 * @static
 * @param {number} netWorth - The net worth value to compare.
 * @param {string} guildId - The guild to compare against.
 * @returns {Promise<Object>} An object with comparison data.
 */
playerSchema.statics.compareNetWorthToTopInGuild = async function (
  netWorth,
  guildId,
) {
  // Retrieve the top 10 players by net worth within the specific guild
  const topPlayers = await this.find({ guildId: guildId })
    .sort({ cash: -1, bank: -1, debt: 1 })
    .limit(30)
    .lean();

  // Calculate the total net worth of the top 10 players in the guild
  const totalTopNetWorth = topPlayers.reduce(
    (acc, player) => acc + player.cash + player.bank - player.debt,
    0,
  );

  // Determine where the given net worth stands in comparison to the top 10 players
  const sortedNetWorths = topPlayers
    .map((player) => player.cash + player.bank - player.debt)
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

module.exports = { playerSchema };
