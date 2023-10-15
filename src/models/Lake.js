const {Schema, model} = require('mongoose');

const FishSchema = new Schema({
  type: String,
  count: Number,
  reward: Number,
});

const LakeSchema = new Schema({
  guildId: String,
  fishes: [FishSchema],
  lastStocked: Date,
});

module.exports = model('Lake', LakeSchema);