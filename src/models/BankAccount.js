const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  balance: { type: Number, default: 0 },
  interestRate: { type: Number, default: 0.01 }, // 1% interest rate
});

module.exports = mongoose.model('BankAccount', bankAccountSchema);
