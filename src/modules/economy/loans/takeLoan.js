const {
  ensurePlayer,
  findPlayer,
  updatePlayerValues,
} = require('../playerService');
const loanLifecycleService = require('../loanLifecycleService');
const { withTransaction } = require('../../../storage/postgres');
const { bumpVersion } = require('../../../storage/cache');

/**
 * Allows a player to take a loan from the bank. The loan incurs a 10% immediate interest.
 *
 * @async
 * @function
 * @param {string} userId - The ID of the user attempting to take the loan.
 * @param {string} guildId - The ID of the guild (server) where the user is a member.
 * @param {number} amount - The amount the player wishes to borrow.
 * @returns {Promise<Object|boolean|null>} An object containing the outcome of the loan or `false` if the loan couldn't be taken, or `null` if the player was not found.
 * @throws Will log an error if saving to the database fails.
 */
async function processLoan(client, userId, guildId, amount, options = {}) {
  await ensurePlayer(userId, guildId, { client });
  const player = await findPlayer(userId, guildId, { client, lock: true });
  const loanSnapshot = await loanLifecycleService.getLoanDebtSnapshot(
    userId,
    guildId,
    { client },
  );

  if (loanSnapshot.outstandingBalance > 0 || loanSnapshot.openContract) {
    return {
      success: false,
      message:
        'Existing debt detected. Cannot take another loan until the current debt is cleared.',
    };
  }

  if (
    !Number.isFinite(player.cash) ||
    player.cash < 0 ||
    !Number.isFinite(player.debt) ||
    player.debt < 0
  ) {
    return {
      success: false,
      message: 'Player balances are invalid.',
    };
  }

  const debtIncrease = Math.round(amount * 1.1);
  const updateResult = await updatePlayerValues(
    player,
    {
      cash: player.cash + amount,
      debt: loanSnapshot.outstandingBalance + debtIncrease,
    },
    { client },
  );

  if (!updateResult.success) {
    throw new Error(updateResult.error);
  }

  const loanContract = await loanLifecycleService.recordLoanActivation(
    {
      userId,
      guildId,
      bankId: options.bankId ?? 'heavenly-accord',
      principal: amount,
      currentBalance: debtIncrease,
      interestRate: options.loanQuote?.interestRate ?? 0,
      estimatedTermMonths: options.loanQuote?.estimatedTermMonths ?? 0,
      bureauScore: options.loanQuote?.bureauScore ?? 0,
      approvalScore: options.loanQuote?.approvalScore ?? 0,
      creditBand: options.loanQuote?.creditBand ?? 'legacy',
      collateralRequirement: options.loanQuote?.collateralRequirement ?? 0,
      metadata: {
        loanAmount: amount,
        legacyDebtBalance: loanSnapshot.outstandingBalance,
      },
    },
    { client },
  );

  if (!loanContract) {
    throw new Error('Failed to create loan lifecycle record.');
  }

  return {
    success: true,
    loanAmount: amount,
    newDebt: player.debt,
    newBalance: player.cash,
    bank: player.bank,
    loanState: loanContract.state,
    loanContract,
  };
}

module.exports = async function takeLoan(
  userId,
  guildId,
  amount,
  options = {},
) {
  if (amount <= 0) {
    return {
      success: false,
      message: 'Invalid loan amount.',
    };
  }

  const result = options.client
    ? await processLoan(options.client, userId, guildId, amount, options)
    : await withTransaction(async (client) => {
        return await processLoan(client, userId, guildId, amount, options);
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
