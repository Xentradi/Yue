const Player = require('../models/Player');
const mongoose = require('mongoose');

class BankingService {
  static async performTransaction(userId, guildId, transaction) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const player = await Player.findOne({userId, guildId}).session(session);
      if (!player) throw new Error('Player not found');

      const transactionResult = transaction(player);

      if (player.cash < 0 || player.bank < 0 || player.debt < 0) {
        throw new Error('Negative balance error');
      }

      await player.save({session});
      await session.commitTransaction();
      session.endSession();

      return {success: true, player, transactionResult};
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return {success: false, error: error.message};
    }
  }

  static deposit(player, amount) {
    amount = Math.floor(amount);
    if (amount <= 0 || player.cash < amount)
      throw new Error('Invalid deposit amount');
    player.cash -= amount;
    player.bank += amount;
  }

  static withdraw(player, amount) {
    amount = Math.floor(amount);
    if (amount <= 0 || player.bank < amount)
      throw new Error('Invalid withdrawal amount');
    player.bank -= amount;
    player.cash += amount;
  }

  static transfer(playerFrom, playerTo, amount) {
    amount = Math.floor(amount);
    if (amount <= 0 || playerFrom.cash < amount)
      throw new Error('Invalid transfer amount');
    playerFrom.cash -= amount;
    playerTo.cash += amount;
  }

  static earn(player, amount) {
    amount = Math.floor(amount);
    const debtRepayment = Math.min(Math.floor(amount * 0.1), player.debt);
    player.debt -= debtRepayment;
    player.cash += amount - debtRepayment;
  }

  static lose(player, amount) {
    amount = Math.floor(amount);
    if (amount <= 0 || player.cash < amount)
      throw new Error('Invalid loss amount');
    player.cash -= amount;
  }

  static applyInterest(player) {
    const bankInterestRate = 0.001 + Math.random() * 0.002;
    player.bank = Math.round(
      player.bank * (1 + bankInterestRate * player.interestMultiplier)
    );
  }

  static takeLoan(player, amount) {
    amount = Math.floor(amount);
    if (amount <= 0) throw new Error('Invalid loan amount');
    player.debt += amount;
    player.cash += amount;
  }

  static repayLoan(player, amount) {
    amount = Math.floor(amount);
    if (amount <= 0 || player.cash < amount || player.debt < amount)
      throw new Error('Invalid repayment amount');
    player.debt -= amount;
    player.cash -= amount;
  }
}

module.exports = BankingService;
