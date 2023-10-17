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
  },
});

module.exports = model('Player', playerSchema);
