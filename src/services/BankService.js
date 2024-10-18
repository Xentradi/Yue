const BankAccount = require('../models/BankAccount');

class BankService {
  static async deposit(userId, guildId, amount) {
    const account = await BankAccount.findOneAndUpdate(
      { userId, guildId },
      { $inc: { balance: amount } },
      { new: true, upsert: true }
    );
    return account;
  }

  static async withdraw(userId, guildId, amount) {
    const account = await BankAccount.findOne({ userId, guildId });
    if (!account || account.balance < amount) {
      throw new Error('Insufficient funds');
    }
    account.balance -= amount;
    await account.save();
    return account;
  }

  static async applyInterest() {
    const accounts = await BankAccount.find();
    for (const account of accounts) {
      account.balance += account.balance * account.interestRate;
      await account.save();
    }
  }
}

module.exports = BankService;
