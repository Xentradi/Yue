const {Schema} = require('mongoose');
const {fishSchema} = require('./fishSchema');

const lakeSchema = new Schema({
  guildId: String,
  fishStock: [fishSchema],
  lastStocked: Date,
});

module.exports = {lakeSchema};
