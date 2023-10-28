const {Schema} = require('mongoose');

const fishSchema = new Schema({
  type: String,
  count: Number,
  reward: Number,
});

fishSchema.index({type: 1});

module.exports = {fishSchema};
