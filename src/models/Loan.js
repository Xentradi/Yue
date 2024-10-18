const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  amount: Number,
  interestRate: { type: Number, default: 0.05 }, // 5% interest rate
  dueDate: Date,
});

module.exports = mongoose.model('Loan', loanSchema);
