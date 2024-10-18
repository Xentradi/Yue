const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  amount: Number,
  interestRate: { type: Number, default: 0.02 }, // 2% interest rate
  maturityDate: Date,
});

module.exports = mongoose.model('Certificate', certificateSchema);
