const {Schema} = require('mongoose');
const statsSchema = require('./statsSchema');

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
  stats: {
    type: statsSchema,
    default: {},
  },
});

module.exports = {playerSchema};
