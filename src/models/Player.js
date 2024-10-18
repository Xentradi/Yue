/**
 * @fileoverview Player schema module.
 * @module playerSchema
 * @requires mongoose
 * @requires statsSchema
 */

const {Schema, model} = require('mongoose');
const {playerSchema} = require('../schemas/playerSchema');

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

const playerSchema = new Schema({
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
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
  standardCurrency: {
    type: Number,
    default: 0,
  },
  premiumCurrency: {
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
  lastDailyBonusClaim: {
    type: Date,
    default: null,
  },
  stats: {
    type: statsSchema,
    default: {},
  },
});

module.exports = model('Player', playerSchema);
