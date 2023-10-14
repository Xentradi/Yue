const {Schema, model} = require('mongoose');

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
  expBonus: {
    type: Number,
    default: 1,
  },
  cashBonus: {
    type: Number,
    default: 1,
  },
  bankInterest: {
    type: Number,
    default: 1,
  },
});

module.exports = model('Player', playerSchema);
