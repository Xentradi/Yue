const mongoose = require('mongoose');
const characterUtils = require('../utils/characterUtils');
const logger = require('../utils/logger');

const characterSchema = new mongoose.Schema({
  discordUserId: {type: String, required: true, ref: 'User'},
  guildId: {type: String, required: true},
  level: {type: number, default: 1},
  exp: {type: Number, default: 0},
  reputation: {type: Number, default: 0},
  characterClass: {type: String, required: true},
  stats: {
    strength: {type: Number, default: 1},
    dexterity: {type: Number, default: 1},
    intelligence: {type: Number, default: 1},
    charisma: {type: Number, default: 1},
    spirit: {type: Number, default: 1},
    focus: {type: Number, default: 1},
    endurance: {type: Number, default: 1},
    luck: {type: Number, default: 1},
    alchemy: {type: Number, default: 1},
    crafting: {type: Number, default: 1},
  },
  currency: {
    standard: {type: Number, default: 0},
    premium: {type: Number, default: 0},

  },
  equipment: {
    mainHand: gearSchema,
    offHand: gearSchema,
    head: gearSchema,
    torso: gearSchema,
    legs: gearSchema,
    feet: gearSchema,
    hands: gearSchema,
    necklace: gearSchema,
    ring1: gearSchema,
    ring2: gearSchema,
    artifact1: gearSchema,
    artifact2: gearSchema,
    artifact3: gearSchema,
    artifact4: gearSchema,
    artifact5: gearSchema,
    artifact6: gearSchema,
    mount: gearSchema,
  },
  inventory: [gearSchema],
  lastDailyClaim: {type: Date, default: null}
})

characterSchema.index({discordUserId: 1, guildId: 1});

characterSchema.method('calculateTotalStats', function () {
  const baseStats = characterUtils.findBaseStats(this.characterClass);
  let totalStats = {...baseStats};

  for (let slot in this.equipment) {
    let item = this.equipment[slot];
    if (item && item.statBonuses) {
      for (let stat in item.statBonuses) {
        if (totalStats[stat]) {
          totalStats[stat] += item.statBonuses[stat];
        }
      }
    }
  }
  return totalStats;
});

characterSchema.method('equipItem', async function (slot, item) {
  this.equipment[slot] = item;
  this.calculateTotalStats();
  try {
    await this.save();
    return {success: true, message: 'Item equipped successfully.'};
  } catch (error) {
    logger.error('Error saving character equipment: ', error);
    return {success: false, message: 'Error equiping item.'};
  }
})

characterSchema.method('addExperience', async function (expToAdd) {
  const levelUpExp = level => {
    const L = 10000; // max exp
    const k = 0.01; // steepness of the curve
    const x0 = 100; // Mid point level

    let sigmoidExp = L / (1 + Math.exp(-k * (level - (level - x0))));
    // Ensuring that the experience to level up is not too low
    sigmoidExp = Math.max(sigmoidExp, level * 10);

    sigmoidExp = Math.round(sigmoidExp);
    logger.debug('TargetLevel: ', level + 1);
    logger.debug('ExpRequired: ', sigmoidExp);
    return sigmoidExp;
  }

  this.exp += expToAdd;
  if (this.exp >= levelUpExp(this.level + 1)) {
    this.level++;
  }

  try {
    this.save();
    return {success: true, message: 'Experience added successfully.'};
  } catch (error) {
    logger.error('Error saving character experience: ', error);
    return {success: false, message: 'Error adding experience.'};
  }

})


module.exports = mongoose.model('Character', characterSchema);



const gearSchema = new mongoose.Schema({
  name: {type: String, required: true},
  type: {type: String, required: true},
  rarity: {type: String, required: true},
  description: {type: String, required: true},
  image: {type: String, default: null},
  statBonuses: {
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
  }
})