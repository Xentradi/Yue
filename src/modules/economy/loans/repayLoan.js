const logger = require('../../../utils/logger');
const {
  ensurePlayer,
  findPlayer,
  updatePlayerValues,
} = require('../playerService');
const loanLifecycleService = require('../loanLifecycleService');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

/**
 * Allows a player to repay a portion or the entirety of their debt.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user attempting to repay the loan.
 * @param {string} guildId - The ID of the guild (server) where the user is a member.
 * @param {number} amount - The amount the player wishes to repay.
 * @returns {Promise<Object>} An object containing the outcome of the repayment.
 * @throws Will log an error if saving to the database fails.
 */
async function processRepayment(client, userId, guildId, amount, options = {}) {
  await ensurePlayer(userId, guildId, { client });
  const player = await findPlayer(userId, guildId, { client, lock: true });
  const loanSnapshot = await loanLifecycleService.getLoanDebtSnapshot(
    userId,
    guildId,
    { client },
  );

  if (
    !Number.isFinite(player.cash) ||
    player.cash < 0 ||
    !Number.isFinite(loanSnapshot.outstandingBalance) ||
    loanSnapshot.outstandingBalance < 0
  ) {
    return {
      success: false,
      message: 'Player balances are invalid.',
    };
  }

  if (loanSnapshot.outstandingBalance <= 0) {
    return {
      success: false,
      message: 'No outstanding debt to repay.',
    };
  }

  const repaymentAmount = Math.min(amount, loanSnapshot.outstandingBalance);

  if (player.cash < repaymentAmount) {
    return {
      success: false,
      message: 'Insufficient funds to repay the loan.',
    };
  }
  const refundAmount = amount - repaymentAmount;

  const updateResult = await updatePlayerValues(
    player,
    {
      debt: loanSnapshot.outstandingBalance - repaymentAmount,
      cash: player.cash - repaymentAmount,
    },
    { client },
  );

  if (!updateResult.success) {
    logger.error(`Failed to save changes to database: ${updateResult.error}`);
    throw new Error('Failed to save changes to the database.');
  }

  const loanContractResult = await loanLifecycleService.recordLoanRepayment(
    {
      userId,
      guildId,
      bankId: options.bankId ?? 'heavenly-accord',
      currentBalance: loanSnapshot.outstandingBalance,
      principal: loanSnapshot.outstandingBalance,
      metadata: {
        legacyDebtBalance: loanSnapshot.outstandingBalance,
      },
    },
    repaymentAmount,
    { client },
  );

  if (!loanContractResult.success) {
    logger.error(
      `Failed to update loan lifecycle record: ${loanContractResult.message}`,
    );
    throw new Error('Failed to save changes to the database.');
  }

  return {
    success: true,
    repaidAmount: repaymentAmount,
    refundedAmount: refundAmount,
    remainingDebt: loanSnapshot.outstandingBalance - repaymentAmount,
    newBalance: player.cash,
    bank: player.bank,
    loanState:
      loanContractResult.loanContract?.state ??
      (loanSnapshot.outstandingBalance - repaymentAmount <= 0
        ? 'closed'
        : 'active'),
    loanContract: loanContractResult.loanContract ?? null,
  };
}

module.exports = async function repayLoan(
  userId,
  guildId,
  amount,
  options = {},
) {
  if (amount <= 0) {
    return {
      success: false,
      message: 'Invalid repayment amount.',
    };
  }

  const result = options.client
    ? await processRepayment(options.client, userId, guildId, amount, options)
    : await withTransaction(async (client) => {
        return await processRepayment(client, userId, guildId, amount, options);
      });

  if (result.success) {
    await Promise.all([
      bumpVersion('player', guildId),
      bumpVersion('leaderboard', guildId),
      bumpVersion('tracked'),
    ]);
  }

  return result;
};
