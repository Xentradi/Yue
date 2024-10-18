/**
 * @fileoverview Bank account schema module.
 * @module bankSchema
 * @requires mongoose

 */

const {Schema, model} = require('mongoose');


const bankSchema = new Schema({
  accountId: {type: mongoose.Schema.Types.ObjectId, required: true},
  playerId: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Player'},
  accountType: {type: String, required: true},
  balance: {type: Number, default: 0},
  interestRate: {type: Number, default: 0},
  lastInterestUpdate: {type: Date, default: null},
})

bankSchema.index({playerId: 1});

module.exports = model('Bank', bankSchema);