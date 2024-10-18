const classes = require('../data/characterClasses.json');

const defaultStats = {
  strength: 1,
  dexterity: 1,
  intelligence: 1,
  charisma: 1,
  spirit: 1,
  focus: 1,
  endurance: 1,
  luck: 1,
  alchemy: 1,
  crafting: 1

}

function findBaseStats(className) {
  for (const mainClass in classes) {
    if (classes[mainClass][className]) {
      return classes[mainClass][className];
    }
  }
  return defaultStats;
}

module.exports = {findBaseStats};