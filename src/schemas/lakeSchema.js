const {Schema} = require('mongoose');
const fishSchema = require('./fishSchema');

module.exports.lakeSchema = new Schema({
  guildId: String,
  fishStock: [fishSchema],
  lastStocked: Date,
});
