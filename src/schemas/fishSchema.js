const {Schema} = require('mongoose');

const fishSchema = new Schema({
  type: String,
  count: Number,
  reward: Number,
});

module.exports = {fishSchema};
