const {Schema} = require('mongoose');

module.exports.fishSchema = new Schema({
  type: String,
  count: Number,
  reward: Number,
});
