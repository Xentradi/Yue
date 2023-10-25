/**
 * @fileoverview Stats schema module.
 * @module statsSchema
 * @requires mongoose
 */

const {Schema} = require('mongoose');

/**
 * @typedef {Object} Stats
 * @property {number} strength - The player's strength stat.
 * @property {number} dexterity - The player's dexterity stat.
 * @property {number} intelligence - The player's intelligence stat.
 * @property {number} charisma - The player's charisma stat.
 * @property {number} spirit - The player's spirit stat.
 * @property {number} focus - The player's focus stat.
 * @property {number} endurance - The player's endurance stat.
 * @property {number} luck - The player's luck stat.
 * @property {number} alchemy - The player's alchemy skill.
 * @property {number} crafting - The player's crafting skill.
 */
const statsSchema = new Schema({
  strength: {type: Number, default: 0},
  dexterity: {type: Number, default: 0},
  intelligence: {type: Number, default: 0},
  charisma: {type: Number, default: 0},
  spirit: {type: Number, default: 0},
  focus: {type: Number, default: 0},
  endurance: {type: Number, default: 0},
  luck: {type: Number, default: 0},
  alchemy: {type: Number, default: 0},
  crafting: {type: Number, default: 0},
});

/**
 * Updates a specified stat of a player by a specified amount.
 * @function updateStat
 * @param {string} stat - The name of the stat to update.
 * @param {number} amount - The amount to update the stat by. Positive values will increase the stat, and negative values will decrease it.
 * @returns {Object} An object indicating success and the new stat value or an error message.
 */
statsSchema.method('updateStat', function (stat, amount) {
  if (this[stat] !== undefined && this[stat] + amount >= 0) {
    this[stat] += amount;
    return {success: true, newStatValue: this[stat]};
  }
  return {success: false, error: 'Invalid stat or amount.'};
});

/**
 * Updates multiple specified stats of a player by specified amounts.
 * @function updateStats
 * @param {Object} updates - An object where keys are the stat names and values are the amounts to update the stats by.
 * @returns {Object} An object indicating success and the new stat values or an error message.
 */
statsSchema.method('updateStats', function (updates) {
  const newValues = {};
  for (const [stat, amount] of Object.entries(updates)) {
    if (this[stat] !== undefined && this[stat] + amount >= 0) {
      this[stat] += amount;
      newValues[stat] = this[stat];
    } else {
      return {
        success: false,
        error: `Invalid stat or amount for stat: ${stat}.`,
      };
    }
  }
  return {success: true, newStatValues: newValues};
});

/**
 * Updates all stats of a player by specified amounts.
 * @function updateAllStats
 * @param {Object} updates - An object where keys are the stat names and values are the amounts to update the stats by.
 * @returns {Object} An object indicating success and the new stat values or an error message.
 */
statsSchema.method('updateAllStats', function (updates) {
  const newValues = {};
  const statsKeys = Object.keys(this.toObject()).filter(
    key => typeof this[key] === 'number'
  );
  for (const stat of statsKeys) {
    const amount = updates[stat];
    if (amount !== undefined && this[stat] + amount >= 0) {
      this[stat] += amount;
      newValues[stat] = this[stat];
    } else if (amount !== undefined) {
      return {success: false, error: `Invalid amount for stat: ${stat}.`};
    }
  }
  return {success: true, newStatValues: newValues};
});

/**
 * Sets a specified stat of a player to a specified value.
 * @function set
 * @param {string} stat - The name of the stat to set.
 * @param {number} value - The value to set the stat to.
 */
statsSchema.method('setStat', async function (stat, amount) {
  if (this[stat] !== undefined && amount >= 0) {
    this[stat] = amount;
  }
});

/**
 * Updates all stats of a player to specified values.
 * @function setAllStats
 * @param {Object} values - An object where keys are the stat names and values are the new values for the stats.
 * @returns {Object} An object indicating success and the new stat values or an error message.
 */
statsSchema.method('setAllStats', function (values) {
  const newValues = {};
  for (const [stat, value] of Object.entries(values)) {
    if (this[stat] !== undefined && value >= 0) {
      this[stat] = value;
      newValues[stat] = this[stat];
    } else {
      return {
        success: false,
        error: `Invalid stat or value for stat: ${stat}.`,
      };
    }
  }
  return {success: true, newStatValues: newValues};
});

statsSchema.method('reset', async function (stat) {
  if (this[stat] !== undefined) {
    this[stat] = 0;
  }
});

module.exports = {statsSchema};
