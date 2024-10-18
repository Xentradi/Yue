const Loan = require('../models/Loan');

class LoanService {
  static async takeLoan(userId, guildId, amount) {
    const loan = new Loan({
      userId,
      guildId,
      amount,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    });
    await loan.save();
    return loan;
  }

  static async repayLoan(userId, guildId, amount) {
    const loan = await Loan.findOne({ userId, guildId });
    if (!loan) {
      throw new Error('No active loan found');
    }
    loan.amount -= amount;
    if (loan.amount <= 0) {
      await loan.remove();
    } else {
      await loan.save();
    }
    return loan;
  }
}

module.exports = LoanService;
