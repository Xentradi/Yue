const {Schema} = require('mongoose');

const economySchema = new Schema({
  economyId: {type: mongoose.types.ObjectId, required: true, unique: true},
  baseInterestRate: {type: Number, required: true},
  premiumInterestRate: {type: Number, required: true},
  lastUpdate: {type: Date, default: Date.now},
})