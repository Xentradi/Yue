const {Schema} = require('mongoose');

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

statsSchema.method({
  increase(stat, amount) {
    if (this[stat] !== undefined && amount > 0) {
      this[stat] += amount;
    }
  },
  decrease(stat, amount) {
    if (this[stat] !== undefined && amount > 0) {
      this[stat] = Math.max(0, this[stat] - amount);
    }
  },
  set(stat, value) {
    if (this[stat] !== undefined && value >= 0) {
      this[stat] = value;
    }
  },
  reset(stat) {
    if (this[stat] !== undefined) {
      this[stat] = 0;
    }
  },
});

module.exports = {statsSchema};
