const config = require('../config.json');

// Calculates the experience needed to level up
async function levelUp(level) {
  return Math.ceil((level / config.expScale) ^ 2);
}

module.exports = {levelUp};
