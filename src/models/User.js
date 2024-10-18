const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordUserId: {type: String, required: true, unique: true},
  vipLevel: {type: Number, default: 0},
  vipPoints: {type: Number, default: 0},
  vipExperienceMultiplier: {type: Number, default: 1.0},
  vipCurrencyMultiplier: {type: Number, default: 1.0},
  vipInterestMultiplier: {type: Number, default: 1.0},
})

userSchema.index({userId: 1});

module.exports = mongoose.model('User', userSchema);