const config = require('../config.json');

// Calculates the experience needed to level up
module.exports.levelUp = function levelUp(level) {
  level += 1;
  return Math.ceil((level / config.expScale) ** 2);
};

/**
 *
 * @param {*} time
 * @returns time in miliseconds
 */
module.exports.convertToSeconds = function convertToSeconds(time) {
  // If its an number just spit it backout.
  if (typeof time === 'number') {
    return time;
  }
  // If it's not a number or a string, throw an error
  if (typeof time !== 'string') {
    throw new Error('Invalid input: time must be a string or number');
  }

  const units = {
    s: 1, // seconds
    m: 60, // minutes
    h: 60 * 60, // hours
    d: 24 * 60 * 60, // days
    w: 7 * 24 * 60 * 60, // weeks
  };

  const regex = /(\d+)(s|m|h|d|w)/g;

  let seconds = 0;

  let match;
  while ((match = regex.exec(time))) {
    const value = parseInt(match[1]);
    const unit = match[2];

    seconds += value * units[unit];
  }

  return seconds;
};
