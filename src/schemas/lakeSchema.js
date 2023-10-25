const {Schema} = require('mongoose');
const {fishSchema} = require('./fishSchema');

const lakeSchema = new Schema({
  guildId: String,
  fishStock: [fishSchema],
  lastStocked: Date,
});

lakeSchema.method('updateFishStock', async (fishType, count, reward) => {
  const fishIndex = this.fishStock.fishIndex(fish => fish.type === fishType);
  if (fishIndex !== -1) {
    this.fishStock[fishIndex].count += count;
  } else {
    this.fishStock.push({type: fishType, count, reward});
  }
  await this.save();
  return {success: true, fishStock: this.fishStock};
});

module.exports = {lakeSchema};
