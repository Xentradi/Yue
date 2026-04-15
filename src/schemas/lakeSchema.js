const { Schema } = require('mongoose');
const { fishSchema } = require('./fishSchema');

function isValidFishEntry(fishType, count, reward) {
  return (
    typeof fishType === 'string' &&
    fishType.trim().length > 0 &&
    Number.isFinite(count) &&
    Number.isFinite(reward)
  );
}

const lakeSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  fishStock: {
    type: [fishSchema],
    default: [],
  },
  lastStocked: {
    type: Date,
    default: null,
  },
});

lakeSchema.method('updateFishStock', async function (fishType, count, reward) {
  if (!isValidFishEntry(fishType, count, reward)) {
    return {
      success: false,
      message: 'Invalid fish stock update.',
    };
  }

  const fishIndex = this.fishStock.findIndex((fish) => fish.type === fishType);
  const previousStock =
    fishIndex !== -1 ? this.fishStock[fishIndex].count : null;

  if (fishIndex !== -1 && this.fishStock[fishIndex].count + count < 0) {
    return {
      success: false,
      message: 'Fish stock cannot go below zero.',
    };
  }

  if (fishIndex === -1 && count < 0) {
    return {
      success: false,
      message: 'Fish stock cannot go below zero.',
    };
  }

  if (fishIndex !== -1) {
    this.fishStock[fishIndex].count += count;
  } else {
    this.fishStock.push({ type: fishType, count, reward });
  }

  try {
    await this.save();
    return { success: true, fishStock: this.fishStock };
  } catch (error) {
    if (fishIndex !== -1) {
      this.fishStock[fishIndex].count = previousStock;
    } else {
      this.fishStock.pop();
    }

    return { success: false, message: error.message };
  }
});

lakeSchema.index({ guildId: 1 });

module.exports = { lakeSchema };
