const assert = require('node:assert/strict');
const test = require('node:test');
const { MessageFlags } = require('discord.js');

const Player = require('../../src/models/Player');
const Lake = require('../../src/models/Lake');
const loanContracts = require('../../src/storage/loanContracts');
const creditProfiles = require('../../src/storage/creditProfiles');
const {
  ensureSchema,
  closePool,
  query,
} = require('../../src/storage/postgres');
const cache = require('../../src/storage/cache');
const config = require('../../src/config.json');
const bankService = require('../../src/modules/economy/bankService');
const creditService = require('../../src/modules/economy/creditService');
const loanDecisionService = require('../../src/modules/economy/loanDecisionService');
const loanLifecycleService = require('../../src/modules/economy/loanLifecycleService');
const dailyBonus = require('../../src/modules/economy/bonuses/dailyBonus');
const deposit = require('../../src/modules/economy/bankOperations/deposit');
const applyBankInterest = require('../../src/modules/economy/bankOperations/interest');
const airdrop = require('../../src/modules/economy/adminOperations/airdrop');
const giveBalance = require('../../src/modules/economy/adminOperations/giveBalance');
const setBalance = require('../../src/modules/economy/adminOperations/setBalance');
const {
  findPlayersByGuild,
} = require('../../src/modules/economy/playerService');
const takeLoan = require('../../src/modules/economy/loans/takeLoan');
const repayLoan = require('../../src/modules/economy/loans/repayLoan');
const withdraw = require('../../src/modules/economy/bankOperations/withdraw');
const giveCash = require('../../src/modules/economy/transfers/giveCash');
const stealCash = require('../../src/modules/economy/transfers/stealCash');
const scheduledTasks = require('../../src/modules/scheduledEvents/scheduledTasks');
const restockLake = require('../../src/modules/games/adminOperations/restockLake');
const getCashLeaderboard = require('../../src/modules/economy/leaderboards/cashLeaderboard');
const getBankLeaderboard = require('../../src/modules/economy/leaderboards/bankLeaderboard');
const getDebtLeaderboard = require('../../src/modules/economy/leaderboards/debtLeaderboard');
const getNetWorthLeaderboard = require('../../src/modules/economy/leaderboards/netWorthLeaderboard');
const economyBalanceHelpers = require('../../src/modules/economy/balance');
const balanceCommand = require('../../src/commands/economy/balance');
const bankCommand = require('../../src/commands/economy/bank');
const loanCommand = require('../../src/commands/economy/loan');
const diceCommand = require('../../src/commands/gamble/dice');
const leaderboardCommand = require('../../src/commands/economy/leaderboard');
const adminEconomyCommand = require('../../src/commands/admin/economy');
const adminRestockLakeCommand = require('../../src/commands/admin/restockLake');
const depositCommand = require('../../src/commands/economy/deposit');
const payCommand = require('../../src/commands/economy/pay');
const { createBalanceEmbed } = require('../../src/utils/economyFeedback');
const { deferGuildInteraction } = require('../../src/utils/interactionHelpers');
const logger = require('../../src/utils/logger');

test.before(async () => {
  await ensureSchema();
});

test.after(async () => {
  await closePool();
  await cache.closeClient();
});

test.beforeEach(async () => {
  await Promise.all([Player.deleteMany({}), Lake.deleteMany({})]);
  await query('DELETE FROM player_loans;');
  await query('DELETE FROM player_bank_preferences;');
});

function createConfirmationReplyStub(updates, shouldConfirm = true) {
  const replyMessage = {
    id: 'confirmation-message',
    createMessageComponentCollector({ filter }) {
      const handlers = {};
      const collector = {
        on(event, handler) {
          handlers[event] = handler;
          return collector;
        },
        stop(reason) {
          queueMicrotask(() => {
            handlers.end?.(new Map(), reason);
          });
        },
      };

      queueMicrotask(() => {
        const componentInteraction = {
          user: { id: 'admin-user' },
          customId: shouldConfirm
            ? 'confirm-action-confirm'
            : 'confirm-action-cancel',
          message: { id: replyMessage.id },
          update: async (payload) => {
            updates.push(payload);
          },
        };

        if (filter(componentInteraction)) {
          handlers.collect?.(componentInteraction);
        }
      });

      return collector;
    },
  };

  return replyMessage;
}

test('daily bonus credits once per day', async () => {
  const userId = 'user-daily';
  const guildId = 'guild-daily';

  await Player.create({
    userId,
    guildId,
    cash: 100,
  });

  const firstClaim = await dailyBonus(userId, guildId);
  assert.equal(firstClaim.success, true);
  assert.equal(firstClaim.amount, config.dailyWage);

  const updatedPlayer = await Player.findOne({ userId, guildId });
  assert.equal(updatedPlayer.cash, 100 + config.dailyWage);
  assert.ok(updatedPlayer.lastDailyBonusClaim instanceof Date);

  const secondClaim = await dailyBonus(userId, guildId);
  assert.equal(secondClaim.success, false);
  assert.equal(secondClaim.message, 'Daily bonus already claimed today.');
});

test('daily bonus creates first-time players before crediting them', async () => {
  const userId = 'user-daily-new';
  const guildId = 'guild-daily-new';

  const claim = await dailyBonus(userId, guildId);
  assert.equal(claim.success, true);

  const player = await Player.findOne({ userId, guildId });
  assert.ok(player);
  assert.equal(player.cash, config.dailyWage);
  assert.ok(player.lastDailyBonusClaim instanceof Date);
});

test('balance command rejects direct messages instead of crashing', async () => {
  let replyPayload;
  const interaction = {
    inGuild: () => false,
    reply: async (payload) => {
      replyPayload = payload;
    },
  };

  await balanceCommand.execute(interaction);

  assert.ok(replyPayload);
  assert.equal(replyPayload.flags, MessageFlags.Ephemeral);
  assert.equal(replyPayload.embeds[0].data.title, '❌ Guild Only');
});

test('deferGuildInteraction stops command execution in direct messages', async () => {
  let replyPayload;
  const interaction = {
    inGuild: () => false,
    reply: async (payload) => {
      replyPayload = payload;
      return { id: 'dm-reply' };
    },
  };

  const allowed = await deferGuildInteraction(interaction, {
    description: 'Server only.',
  });

  assert.equal(allowed, false);
  assert.ok(replyPayload);
  assert.equal(replyPayload.embeds[0].data.title, '❌ Guild Only');
});

test('balance command defers and creates first-time users in guilds', async () => {
  const userId = 'balance-guild-user';
  const guildId = 'guild-balance-command';

  let deferCalled = false;
  let editReplyPayload;
  const interaction = {
    inGuild: () => true,
    guildId,
    user: { id: userId, username: 'BalanceUser' },
    member: { displayName: 'Balance User' },
    options: {},
    deferReply: async () => {
      deferCalled = true;
    },
    editReply: async (payload) => {
      editReplyPayload = payload;
    },
  };

  await balanceCommand.execute(interaction);

  const player = await Player.findOne({ userId, guildId });
  assert.equal(deferCalled, true);
  assert.ok(editReplyPayload);
  assert.equal(
    editReplyPayload.embeds[0].data.title,
    '💰 Financial Statement for Balance User',
  );
  assert.equal(player.cash, 0);
  assert.equal(player.bank, 0);
  assert.equal(player.debt, 0);
});

test('balance embeds treat missing bank and debt as zero instead of NaN', () => {
  const embed = createBalanceEmbed({
    title: 'Balance Snapshot',
    cash: 125,
  });

  assert.deepEqual(
    embed.data.fields.map((field) => field.value),
    ['$125', '$0', '$0', '$125'],
  );
});

test('deposit and pay commands accept legacy option names without crashing', async () => {
  const guildId = 'guild-legacy-options';
  const senderId = 'legacy-sender';
  const recipientId = 'legacy-recipient';

  await Player.create([
    { userId: senderId, guildId, cash: 1000, bank: 0, debt: 0 },
    { userId: recipientId, guildId, cash: 200, bank: 0, debt: 0 },
  ]);

  let payReplyPayload;
  const payInteraction = {
    inGuild: () => true,
    guildId,
    user: { id: senderId, username: 'LegacySender' },
    member: { displayName: 'Legacy Sender' },
    options: {
      getUser: (name) =>
        name === 'target_user'
          ? { id: recipientId, username: 'LegacyRecipient' }
          : null,
      getInteger: (name) => (name === 'cash_amount' ? 150 : null),
    },
    deferReply: async () => {},
    editReply: async (payload) => {
      payReplyPayload = payload;
    },
  };

  await payCommand.execute(payInteraction);

  assert.ok(payReplyPayload);
  assert.equal(payReplyPayload.embeds[0].data.title, '💸 Transfer Completed');

  let depositReplyPayload;
  const depositInteraction = {
    inGuild: () => true,
    guildId,
    user: { id: senderId, username: 'LegacySender' },
    member: { displayName: 'Legacy Sender' },
    options: {
      getInteger: (name) => (name === 'cash_amount' ? 200 : null),
    },
    deferReply: async () => {},
    editReply: async (payload) => {
      depositReplyPayload = payload;
    },
  };

  await depositCommand.execute(depositInteraction);

  assert.ok(depositReplyPayload);
  assert.equal(
    depositReplyPayload.embeds[0].data.title,
    '🏦 Deposit Completed for Legacy Sender',
  );
});

test('deposit and withdraw move money between cash and bank', async () => {
  const userId = 'user-banking';
  const guildId = 'guild-banking';

  await Player.create({
    userId,
    guildId,
    cash: 5000,
    bank: 0,
    debt: 0,
  });

  const depositResult = await deposit(userId, guildId, 1250);
  assert.equal(depositResult.success, true);
  assert.equal(depositResult.cash, 3750);
  assert.equal(depositResult.bank, 1250);

  const withdrawResult = await withdraw(userId, guildId, 250);
  assert.equal(withdrawResult.success, true);
  assert.equal(withdrawResult.cash, 4000);
  assert.equal(withdrawResult.bank, 1000);
});

test('bank service stores and resolves the active bank globally per user', async () => {
  const userId = 'bank-service-user';

  const defaultState = await bankService.getActiveBank(userId);
  assert.equal(defaultState.activeBank.id, 'heavenly-accord');

  const setResult = await bankService.setActiveBank(userId, 'golden-abacus');
  assert.equal(setResult.success, true);
  assert.equal(setResult.activeBank.name, 'Golden Abacus Consortium');

  const resolved = await bankService.getActiveBank(userId);
  assert.equal(resolved.activeBank.id, 'golden-abacus');

  const preference = await query(
    'SELECT active_bank FROM player_bank_preferences WHERE user_id = $1',
    [userId],
  );
  assert.equal(preference.rows[0].active_bank, 'golden-abacus');
});

test('bank command shows and updates the active bank with autocomplete support', async () => {
  const userId = 'bank-command-user';

  await bankService.setActiveBank(userId, 'nine-abyss');

  let deferCalled = false;
  let editReplyPayload;
  const showInteraction = {
    inGuild: () => false,
    user: { id: userId, username: 'BankUser' },
    options: {
      getString: () => null,
    },
    deferReply: async () => {
      deferCalled = true;
    },
    editReply: async (payload) => {
      editReplyPayload = payload;
    },
  };

  await bankCommand.execute(showInteraction);

  assert.equal(deferCalled, true);
  assert.equal(editReplyPayload.embeds[0].data.title, '🏦 Active Bank');
  assert.match(
    editReplyPayload.embeds[0].data.description,
    /Nine Abyss Treasury/,
  );

  let updateReplyPayload;
  const updateInteraction = {
    inGuild: () => true,
    guild: {
      members: {
        cache: new Map([
          [
            userId,
            {
              displayName: 'Bank User',
            },
          ],
        ]),
      },
    },
    member: {
      displayName: 'Bank User',
    },
    user: { id: userId, username: 'BankUser' },
    options: {
      getString: (name) =>
        name === 'bank' ? 'Golden Abacus Consortium' : null,
    },
    deferReply: async () => {},
    editReply: async (payload) => {
      updateReplyPayload = payload;
    },
  };

  await bankCommand.execute(updateInteraction);

  assert.equal(
    updateReplyPayload.embeds[0].data.title,
    '🏦 Active Bank Updated',
  );
  assert.match(
    updateReplyPayload.embeds[0].data.description,
    /Golden Abacus Consortium/,
  );

  const autocompleteInteraction = {
    options: {
      getFocused: () => 'abacus',
    },
    respond: async (payload) => {
      autocompleteInteraction.choices = payload;
    },
  };

  await bankCommand.autocomplete(autocompleteInteraction);

  assert.deepEqual(autocompleteInteraction.choices, [
    {
      name: 'Golden Abacus Consortium',
      value: 'golden-abacus',
    },
  ]);
});

test('loan command routes borrow and repay flows through the active bank', async () => {
  const userId = 'loan-command-user';
  const guildId = 'guild-loan-command';

  await bankService.setActiveBank(userId, 'golden-abacus');

  let quoteReplyPayload;
  const quoteInteraction = {
    inGuild: () => true,
    guildId,
    user: { id: userId, username: 'LoanUser' },
    member: {
      displayName: 'Loan User',
    },
    options: {
      getSubcommand: () => 'quote',
      getInteger: (name) => (name === 'amount' ? 500 : null),
    },
    deferReply: async () => {},
    editReply: async (payload) => {
      quoteReplyPayload = payload;
    },
  };

  await loanCommand.execute(quoteInteraction);

  assert.equal(
    quoteReplyPayload.embeds[0].data.title,
    '📜 Loan Quote from Golden Abacus Consortium',
  );
  assert.equal(quoteReplyPayload.embeds[0].data.fields[0].name, 'Credit Score');
  assert.match(
    quoteReplyPayload.embeds[0].data.fields[0].value,
    /\(good|fair|very good|exceptional|poor\)/,
  );

  let takeLoanReplyPayload;
  const takeLoanInteraction = {
    inGuild: () => true,
    guildId,
    user: { id: userId, username: 'LoanUser' },
    member: {
      displayName: 'Loan User',
    },
    options: {
      getSubcommand: () => 'take',
      getInteger: (name) => (name === 'amount' ? 200 : null),
    },
    deferReply: async () => {},
    editReply: async (payload) => {
      takeLoanReplyPayload = payload;
    },
  };

  await loanCommand.execute(takeLoanInteraction);

  assert.equal(
    takeLoanReplyPayload.embeds[0].data.title,
    '🏦 Loan Approved by Golden Abacus Consortium',
  );
  assert.match(
    takeLoanReplyPayload.embeds[0].data.description,
    /Borrowed \$200 from Golden Abacus Consortium\./,
  );

  let repayLoanReplyPayload;
  const repayLoanInteraction = {
    inGuild: () => true,
    guildId,
    user: { id: userId, username: 'LoanUser' },
    member: {
      displayName: 'Loan User',
    },
    options: {
      getSubcommand: () => 'repay',
      getInteger: (name) => (name === 'amount' ? 70 : null),
    },
    deferReply: async () => {},
    editReply: async (payload) => {
      repayLoanReplyPayload = payload;
    },
  };

  await loanCommand.execute(repayLoanInteraction);

  assert.equal(
    repayLoanReplyPayload.embeds[0].data.title,
    '💳 Loan Repayment Completed at Golden Abacus Consortium',
  );
  assert.match(
    repayLoanReplyPayload.embeds[0].data.description,
    /Repaid \$70 to Golden Abacus Consortium\./,
  );
});

test('loan quotes reflect bank-specific credit modifiers', async () => {
  const userId = 'loan-modifier-user';
  const guildId = 'guild-loan-modifier';

  await creditProfiles.setCreditProfile(userId, {
    bureauScore: 720,
  });

  await bankService.setActiveBank(userId, 'heavenly-accord');
  const heavenlyQuote = await bankService.getLoanQuote(userId, guildId, 500);

  await bankService.setActiveBank(userId, 'nine-abyss');
  const abyssQuote = await bankService.getLoanQuote(userId, guildId, 500);

  assert.equal(heavenlyQuote.success, true);
  assert.equal(abyssQuote.success, true);
  assert.equal(heavenlyQuote.bureauScore, 720);
  assert.equal(abyssQuote.bureauScore, 720);
  assert.ok(
    heavenlyQuote.approvalScore > abyssQuote.approvalScore,
    'Heavenly Accord should be more permissive than Nine Abyss for the same bureau score',
  );
  assert.notEqual(heavenlyQuote.collateralLabel, abyssQuote.collateralLabel);
  assert.notEqual(
    heavenlyQuote.interestRateLabel,
    abyssQuote.interestRateLabel,
  );
});

test('bank alignment tightens maintenance tolerance and foreclosure pressure', () => {
  const righteousPolicy = creditService.getBankPolicy('heavenly-accord');
  const neutralPolicy = creditService.getBankPolicy('golden-abacus');
  const demonicPolicy = creditService.getBankPolicy('nine-abyss');

  assert.equal(righteousPolicy.alignment, 'righteous');
  assert.equal(neutralPolicy.alignment, 'neutral');
  assert.equal(demonicPolicy.alignment, 'demonic');
  assert.ok(
    righteousPolicy.lateThresholdMultiplier <
      neutralPolicy.lateThresholdMultiplier,
  );
  assert.ok(
    demonicPolicy.delinquencyFeeMultiplier >
      righteousPolicy.delinquencyFeeMultiplier,
  );
  assert.ok(
    demonicPolicy.foreclosureFeeMultiplier >
      righteousPolicy.foreclosureFeeMultiplier,
  );

  const now = new Date('2026-04-20T00:00:00Z');
  const righteousAction = loanLifecycleService.getMaintenanceAction(
    {
      bankId: 'heavenly-accord',
      state: loanContracts.LOAN_STATES.ACTIVE,
      currentBalance: 220,
      updatedAt: new Date(now.getTime() - 23 * 36e5),
    },
    now,
  );
  const neutralAction = loanLifecycleService.getMaintenanceAction(
    {
      bankId: 'golden-abacus',
      state: loanContracts.LOAN_STATES.ACTIVE,
      currentBalance: 220,
      updatedAt: new Date(now.getTime() - 23 * 36e5),
    },
    now,
  );

  assert.equal(righteousAction.action, 'late');
  assert.equal(neutralAction.action, 'skip');
});

test('loan decision service matches lifecycle maintenance boundaries', () => {
  const now = new Date('2026-04-20T00:00:00Z');
  const decision = loanDecisionService.getMaintenanceAction(
    {
      bankId: 'nine-abyss',
      state: loanContracts.LOAN_STATES.DELINQUENT,
      currentBalance: 220,
      updatedAt: new Date(now.getTime() - 60 * 36e5),
    },
    now,
  );

  assert.equal(decision.action, 'foreclosure_warning');
  assert.equal(decision.policy.alignment, 'demonic');
  assert.ok(decision.policy.foreclosureWarningHours > 0);
});

test('dice command surfaces balance update failures', async () => {
  const userId = 'dice-user';
  const guildId = 'guild-dice';

  await Player.create({
    userId,
    guildId,
    cash: 500,
    bank: 0,
    debt: 0,
  });

  const originalUpdatePlayerCash = economyBalanceHelpers.updatePlayerCash;
  let replyPayload;

  economyBalanceHelpers.updatePlayerCash = async () => ({
    success: false,
    message: 'Database write failed.',
  });

  const interaction = {
    inGuild: () => true,
    guildId,
    user: { id: userId, username: 'DiceUser' },
    member: { displayName: 'Dice User' },
    options: {
      getInteger: (name) => (name === 'guess' ? 1 : 100),
    },
    reply: async (payload) => {
      replyPayload = payload;
    },
  };

  try {
    await diceCommand.execute(interaction);
  } finally {
    economyBalanceHelpers.updatePlayerCash = originalUpdatePlayerCash;
  }

  assert.ok(replyPayload);
  assert.equal(replyPayload.embeds[0].data.title, '🎲 Dice Roll Failed');
  assert.equal(
    replyPayload.embeds[0].data.description,
    'Database write failed.',
  );
});

test('cash transfer updates both player balances', async () => {
  const guildId = 'guild-transfer';
  const senderId = 'sender';
  const recipientId = 'recipient';

  await Player.create([
    { userId: senderId, guildId, cash: 1000, bank: 0, debt: 0 },
    { userId: recipientId, guildId, cash: 150, bank: 0, debt: 0 },
  ]);

  const result = await giveCash(senderId, recipientId, guildId, 300);
  assert.equal(result.success, true);
  assert.equal(result.transferredAmount, 300);

  const sender = await Player.findOne({ userId: senderId, guildId });
  const recipient = await Player.findOne({ userId: recipientId, guildId });

  assert.equal(sender.cash, 700);
  assert.equal(recipient.cash, 450);
});

test('player transfer helper rolls back cleanly when the recipient update fails', async () => {
  const guildId = 'guild-transfer-rollback';
  const senderId = 'rollback-sender';
  const recipientId = 'rollback-recipient';

  await Player.create([
    { userId: senderId, guildId, cash: 1000, bank: 0, debt: 0 },
    { userId: recipientId, guildId, cash: 200, bank: 0, debt: 0 },
  ]);

  const originalUpdateOne = Player.updateOne;
  Player.updateOne = async function (filter, update, options) {
    if (filter._id && update.$set?.cash === 450) {
      return { modifiedCount: 0 };
    }

    return originalUpdateOne.call(this, filter, update, options);
  };

  try {
    const result = await Player.transferCurrency(
      guildId,
      senderId,
      recipientId,
      250,
    );

    assert.equal(result.success, false);
    assert.equal(result.error, 'Failed to update recipient balance.');
  } finally {
    Player.updateOne = originalUpdateOne;
  }

  const sender = await Player.findOne({ userId: senderId, guildId });
  const recipient = await Player.findOne({ userId: recipientId, guildId });

  assert.equal(sender.cash, 1000);
  assert.equal(recipient.cash, 200);
});

test('player transfer helper uses user and guild identifiers', async () => {
  const guildId = 'guild-schema-transfer';
  const senderId = 'schema-sender';
  const recipientId = 'schema-recipient';

  await Player.create([
    { userId: senderId, guildId, cash: 800, bank: 0, debt: 0 },
    { userId: recipientId, guildId, cash: 200, bank: 0, debt: 0 },
  ]);

  const result = await Player.transferCurrency(
    guildId,
    senderId,
    recipientId,
    250,
  );

  assert.equal(result.success, true);
  assert.equal(result.transferredAmount, 250);

  const sender = await Player.findOne({ userId: senderId, guildId });
  const recipient = await Player.findOne({ userId: recipientId, guildId });

  assert.equal(sender.cash, 550);
  assert.equal(recipient.cash, 450);
});

test('player balance methods reject invalid and overdraft updates', async () => {
  const player = await Player.create({
    userId: 'balance-methods',
    guildId: 'guild-methods',
    cash: 75,
    bank: 20,
    debt: 5,
  });

  const overdraft = await player.updateCash(-100);
  assert.equal(overdraft.success, false);
  assert.equal(overdraft.error, 'Insufficient funds.');

  const invalidAmount = await player.updateBank(Number.NaN);
  assert.equal(invalidAmount.success, false);
  assert.equal(invalidAmount.error, 'Amount must be a valid number.');

  const invalidValues = await player.setValues({ cash: -1 });
  assert.equal(invalidValues.success, false);
  assert.equal(invalidValues.error, 'Invalid value for cash.');

  const reloaded = await Player.findById(player._id);
  assert.equal(reloaded.cash, 75);
  assert.equal(reloaded.bank, 20);
  assert.equal(reloaded.debt, 5);
});

test('repay loan returns extra cash when the payment exceeds the debt', async () => {
  const userId = 'user-loan';
  const guildId = 'guild-loan';

  await Player.create({
    userId,
    guildId,
    cash: 100,
    debt: 50,
  });

  const result = await repayLoan(userId, guildId, 70);
  assert.equal(result.success, true);
  assert.equal(result.repaidAmount, 50);
  assert.equal(result.refundedAmount, 20);
  assert.equal(result.remainingDebt, 0);
  assert.equal(result.newBalance, 50);

  const player = await Player.findOne({ userId, guildId });
  assert.equal(player.cash, 50);
  assert.equal(player.debt, 0);

  const loanContract = await loanContracts.getOpenLoanContract(userId, guildId);
  assert.equal(loanContract, null);

  const loanHistory = await loanContracts.listLoanContracts(userId, guildId);
  assert.equal(loanHistory.length, 1);
  assert.equal(loanHistory[0].state, 'closed');
  assert.equal(loanHistory[0].currentBalance, 0);
});

test('repay loan caps the repayment at the outstanding debt', async () => {
  const userId = 'user-loan-cap';
  const guildId = 'guild-loan-cap';

  await Player.create({
    userId,
    guildId,
    cash: 60,
    debt: 50,
  });

  const result = await repayLoan(userId, guildId, 70);
  assert.equal(result.success, true);
  assert.equal(result.repaidAmount, 50);
  assert.equal(result.refundedAmount, 20);
  assert.equal(result.remainingDebt, 0);
  assert.equal(result.newBalance, 10);

  const player = await Player.findOne({ userId, guildId });
  assert.equal(player.cash, 10);
  assert.equal(player.debt, 0);
});

test('repay loan uses the contract balance when compatibility debt drifts', async () => {
  const userId = 'user-loan-contract-source';
  const guildId = 'guild-loan-contract-source';

  await Player.create({
    userId,
    guildId,
    cash: 100,
    debt: 0,
  });

  await takeLoan(userId, guildId, 200);

  await query(
    `
      UPDATE players
      SET debt = 999
      WHERE user_id = $1 AND guild_id = $2;
    `,
    [userId, guildId],
  );

  const result = await repayLoan(userId, guildId, 50);
  assert.equal(result.success, true);
  assert.equal(result.repaidAmount, 50);
  assert.equal(result.remainingDebt, 170);
  assert.equal(result.loanState, 'active');

  const player = await Player.findOne({ userId, guildId });
  const loanContract = await loanContracts.getOpenLoanContract(userId, guildId);

  assert.equal(player.debt, 170);
  assert.equal(loanContract.currentBalance, 170);
});

test('take loan increases cash and tracks the new debt', async () => {
  const userId = 'user-take-loan';
  const guildId = 'guild-take-loan';

  await Player.create({
    userId,
    guildId,
    cash: 100,
    debt: 0,
  });

  const result = await takeLoan(userId, guildId, 200);
  assert.equal(result.success, true);
  assert.equal(result.loanAmount, 200);
  assert.equal(result.newBalance, 300);
  assert.ok(Math.abs(result.newDebt - 220) < 1e-9);

  const player = await Player.findOne({ userId, guildId });
  assert.equal(player.cash, 300);
  assert.ok(Math.abs(player.debt - 220) < 1e-9);

  const loanContract = await loanContracts.getOpenLoanContract(userId, guildId);
  assert.ok(loanContract);
  assert.equal(loanContract.state, 'active');
  assert.equal(loanContract.bankId, 'heavenly-accord');
  assert.equal(loanContract.principal, 200);
  assert.equal(loanContract.currentBalance, 220);
});

test('take loan creates a first-time player before granting credit', async () => {
  const userId = 'user-take-loan-new';
  const guildId = 'guild-take-loan-new';

  const result = await takeLoan(userId, guildId, 200);
  assert.equal(result.success, true);
  assert.equal(result.loanAmount, 200);
  assert.equal(result.newBalance, 200);
  assert.ok(Math.abs(result.newDebt - 220) < 1e-9);

  const player = await Player.findOne({ userId, guildId });
  assert.ok(player);
  assert.equal(player.cash, 200);
  assert.ok(Math.abs(player.debt - 220) < 1e-9);
});

test('loan lifecycle maintenance advances overdue loans through delinquency and foreclosure', async () => {
  const userId = 'user-loan-lifecycle';
  const guildId = 'guild-loan-lifecycle';

  await Player.create({
    userId,
    guildId,
    cash: 100,
    debt: 0,
  });

  await takeLoan(userId, guildId, 200);

  await query(
    `
      UPDATE player_loans
      SET updated_at = NOW() - INTERVAL '100 hours'
      WHERE user_id = $1 AND guild_id = $2;
    `,
    [userId, guildId],
  );

  let result = await loanLifecycleService.runLoanLifecycleMaintenance();
  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1);

  let contract = await loanContracts.getOpenLoanContract(userId, guildId);
  let player = await Player.findOne({ userId, guildId });
  assert.equal(contract.state, 'late');
  assert.equal(contract.currentBalance, 220);
  assert.equal(player.debt, 220);

  await query(
    `
      UPDATE player_loans
      SET updated_at = NOW() - INTERVAL '100 hours'
      WHERE user_id = $1 AND guild_id = $2;
    `,
    [userId, guildId],
  );

  result = await loanLifecycleService.runLoanLifecycleMaintenance();
  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1);

  contract = await loanContracts.getOpenLoanContract(userId, guildId);
  player = await Player.findOne({ userId, guildId });
  assert.equal(contract.state, 'delinquent');
  assert.equal(contract.currentBalance, 231);
  assert.equal(player.debt, 231);

  await query(
    `
      UPDATE player_loans
      SET updated_at = NOW() - INTERVAL '100 hours'
      WHERE user_id = $1 AND guild_id = $2;
    `,
    [userId, guildId],
  );

  result = await loanLifecycleService.runLoanLifecycleMaintenance();
  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1);

  contract = await loanContracts.getOpenLoanContract(userId, guildId);
  player = await Player.findOne({ userId, guildId });
  assert.equal(contract.state, 'foreclosure warning');
  assert.equal(contract.currentBalance, 253);
  assert.equal(player.debt, 253);

  await query(
    `
      UPDATE player_loans
      SET updated_at = NOW() - INTERVAL '100 hours'
      WHERE user_id = $1 AND guild_id = $2;
    `,
    [userId, guildId],
  );

  result = await loanLifecycleService.runLoanLifecycleMaintenance();
  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1);

  contract = await loanContracts.getLoanContractById(contract.id);
  player = await Player.findOne({ userId, guildId });
  assert.equal(contract.state, 'foreclosed');
  assert.equal(contract.currentBalance, 0);
  assert.equal(player.debt, 0);
});

test('bank policy changes how quickly overdue loans age into penalties', async () => {
  const goldenUserId = 'user-loan-golden-policy';
  const abyssUserId = 'user-loan-abyss-policy';
  const guildId = 'guild-loan-policy';

  await bankService.setActiveBank(goldenUserId, 'golden-abacus');
  await bankService.setActiveBank(abyssUserId, 'nine-abyss');

  await Player.create([
    { userId: goldenUserId, guildId, cash: 100, debt: 0 },
    { userId: abyssUserId, guildId, cash: 100, debt: 0 },
  ]);

  await bankService.takeLoan(goldenUserId, guildId, 200);
  await bankService.takeLoan(abyssUserId, guildId, 200);

  await query(
    `
      UPDATE player_loans
      SET updated_at = NOW() - INTERVAL '20 hours'
      WHERE user_id = ANY($1::text[]) AND guild_id = $2;
    `,
    [[goldenUserId, abyssUserId], guildId],
  );

  let result = await loanLifecycleService.runLoanLifecycleMaintenance();
  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1);

  const goldenContract = await loanContracts.getOpenLoanContract(
    goldenUserId,
    guildId,
  );
  let abyssContract = await loanContracts.getOpenLoanContract(
    abyssUserId,
    guildId,
  );
  assert.equal(goldenContract.state, 'active');
  assert.equal(goldenContract.currentBalance, 220);
  assert.equal(abyssContract.state, 'late');
  assert.equal(abyssContract.currentBalance, 220);

  await query(
    `
      UPDATE player_loans
      SET updated_at = NOW() - INTERVAL '40 hours'
      WHERE user_id = $1 AND guild_id = $2;
    `,
    [abyssUserId, guildId],
  );

  result = await loanLifecycleService.runLoanLifecycleMaintenance();
  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1);

  abyssContract = await loanContracts.getOpenLoanContract(abyssUserId, guildId);
  const abyssPlayer = await Player.findOne({ userId: abyssUserId, guildId });
  assert.equal(abyssContract.state, 'delinquent');
  assert.ok(abyssContract.currentBalance > 220);
  assert.ok(abyssPlayer.debt > 220);
});

test('bank interest updates every player account when run globally', async () => {
  await Player.create([
    {
      userId: 'guild-one-player',
      guildId: 'guild-one',
      cash: 0,
      bank: 2000,
      debt: 1000,
    },
    {
      userId: 'guild-two-player',
      guildId: 'guild-two',
      cash: 0,
      bank: 3000,
      debt: 2000,
    },
  ]);

  const result = await applyBankInterest();
  assert.equal(result.success, true);

  const guildOne = await Player.findOne({
    userId: 'guild-one-player',
    guildId: 'guild-one',
  });
  const guildTwo = await Player.findOne({
    userId: 'guild-two-player',
    guildId: 'guild-two',
  });

  assert.ok(guildOne.bank > 2000);
  assert.ok(guildOne.debt > 1000);
  assert.ok(guildTwo.bank > 3000);
  assert.ok(guildTwo.debt > 2000);
});

test('admin set and give balance operations validate fields and debt behavior', async () => {
  const userId = 'user-admin';
  const guildId = 'guild-admin';

  await Player.create({
    userId,
    guildId,
    cash: 100,
    bank: 200,
    debt: 300,
  });

  const invalidSet = await setBalance({
    guildId,
    options: {
      getUser: () => ({ id: userId }),
      getString: () => 'casch',
      getInteger: () => 500,
    },
  });
  assert.equal(invalidSet.success, false);
  assert.equal(invalidSet.error, 'Invalid balance field.');

  const setCash = await setBalance({
    guildId,
    options: {
      getUser: () => ({ id: userId }),
      getString: (field) => (field === 'field' ? 'cash' : undefined),
      getInteger: (field) => (field === 'amount' ? 900 : undefined),
    },
  });
  assert.equal(setCash.success, true);
  assert.equal(setCash.newAmount, 900);

  const giveDebt = await giveBalance({
    guildId,
    options: {
      getUser: () => ({ id: userId }),
      getString: (field) => (field === 'field' ? 'debt' : undefined),
      getInteger: (field) => (field === 'amount' ? 120 : undefined),
    },
  });
  assert.equal(giveDebt.success, true);
  assert.equal(giveDebt.newAmount, 180);

  const player = await Player.findOne({ userId, guildId });
  assert.equal(player.cash, 900);
  assert.equal(player.bank, 200);
  assert.equal(player.debt, 180);
});

test('admin airdrop credits active members in the current channel', async () => {
  const guildId = 'guild-airdrop';

  await Player.create([
    { userId: 'airdrop-a', guildId, cash: 10, bank: 0, debt: 0 },
    { userId: 'airdrop-b', guildId, cash: 20, bank: 0, debt: 0 },
  ]);

  const channelMembers = new Map([
    ['airdrop-a', { user: { id: 'airdrop-a', bot: false } }],
    ['airdrop-b', { user: { id: 'airdrop-b', bot: false } }],
  ]);

  const result = await airdrop({
    guildId,
    channel: { members: channelMembers },
    options: {
      getInteger: () => 50,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.amount, 50);
  assert.equal(result.total, 100);
  assert.equal(result.recipientCount, 2);

  const players = await Player.find({ guildId }).sort({ userId: 1 });
  assert.equal(players[0].cash, 60);
  assert.equal(players[1].cash, 70);
});

test('admin airdrop creates active members without profiles before crediting them', async () => {
  const guildId = 'guild-airdrop-new';

  const channelMembers = new Map([
    ['airdrop-new-a', { user: { id: 'airdrop-new-a', bot: false } }],
    ['airdrop-new-b', { user: { id: 'airdrop-new-b', bot: false } }],
  ]);

  const result = await airdrop({
    guildId,
    channel: { members: channelMembers },
    options: {
      getInteger: () => 50,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.recipientCount, 2);
  assert.equal(result.total, 100);

  const players = await Player.find({ guildId }).sort({ userId: 1 });
  assert.equal(players.length, 2);
  assert.equal(players[0].cash, 50);
  assert.equal(players[1].cash, 50);
});

test('steal cash auto-creates missing players and reports empty targets', async () => {
  const result = await stealCash(
    'missing-thief',
    'missing-target',
    'guild-steal',
    50,
  );

  assert.equal(result.successful, false);
  assert.equal(result.message, 'Target has no cash to steal.');

  const thief = await Player.findOne({
    userId: 'missing-thief',
    guildId: 'guild-steal',
  });
  const target = await Player.findOne({
    userId: 'missing-target',
    guildId: 'guild-steal',
  });

  assert.ok(thief);
  assert.ok(target);
  assert.equal(thief.cash, 0);
  assert.equal(target.cash, 0);
});

test('scheduled maintenance updates all player accounts and public lakes', async () => {
  await Player.create([
    {
      userId: 'maintenance-player',
      guildId: 'guild-player',
      cash: 0,
      bank: 2000,
      debt: 1000,
    },
    {
      userId: 'maintenance-player-two',
      guildId: 'guild-player-two',
      cash: 0,
      bank: 3000,
      debt: 1500,
    },
  ]);

  await Lake.create([
    { guildId: 'guild-player', fishStock: [] },
    { guildId: 'guild-public-lake', fishStock: [] },
    { guildId: 'guild-clan-lake', ownershipType: 'clan', fishStock: [] },
  ]);

  const publicLakeIds = await scheduledTasks.getPublicLakeIds();
  assert.deepEqual(publicLakeIds.sort(), ['guild-player', 'guild-public-lake']);

  const originalDistinct = Player.distinct;
  Player.distinct = async () => {
    throw new Error(
      'scheduled maintenance should not derive bank work from Player.distinct',
    );
  };

  try {
    await scheduledTasks.runDailyMaintenance();
  } finally {
    Player.distinct = originalDistinct;
  }

  const player = await Player.findOne({
    userId: 'maintenance-player',
    guildId: 'guild-player',
  });
  const playerTwo = await Player.findOne({
    userId: 'maintenance-player-two',
    guildId: 'guild-player-two',
  });
  const playerLake = await Lake.findOne({ guildId: 'guild-player' });
  const publicLake = await Lake.findOne({ guildId: 'guild-public-lake' });
  const clanLake = await Lake.findOne({ guildId: 'guild-clan-lake' });

  assert.ok(player.bank > 2000);
  assert.ok(player.debt > 1000);
  assert.ok(playerTwo.bank > 3000);
  assert.ok(playerTwo.debt > 1500);
  assert.equal(
    playerLake.fishStock.reduce((total, fish) => total + fish.count, 0),
    5500,
  );
  assert.equal(
    publicLake.fishStock.reduce((total, fish) => total + fish.count, 0),
    5500,
  );
  assert.equal(
    clanLake.fishStock.reduce((total, fish) => total + fish.count, 0),
    0,
  );
});

test('scheduled loan lifecycle maintenance advances overdue loans on its own', async () => {
  const userId = 'scheduled-loan-player';
  const guildId = 'scheduled-loan-guild';

  await Player.create({
    userId,
    guildId,
    cash: 100,
    debt: 0,
  });

  await takeLoan(userId, guildId, 200);

  await query(
    `
      UPDATE player_loans
      SET updated_at = NOW() - INTERVAL '100 hours'
      WHERE user_id = $1 AND guild_id = $2;
    `,
    [userId, guildId],
  );

  const result = await scheduledTasks.runLoanLifecycleMaintenance();
  assert.equal(result.updatedCount, 1);
  assert.equal(result.skippedCount, 0);

  const contract = await loanContracts.getOpenLoanContract(userId, guildId);
  const player = await Player.findOne({ userId, guildId });

  assert.equal(contract.state, 'late');
  assert.equal(contract.currentBalance, 220);
  assert.equal(player.debt, 220);
});

test('scheduled lake maintenance targets public lakes instead of player guilds', async () => {
  await Player.create({
    userId: 'lake-player-only',
    guildId: 'guild-player-only',
    cash: 0,
    bank: 0,
    debt: 0,
  });

  await Lake.create({ guildId: 'guild-public-only', fishStock: [] });
  await Lake.create({
    guildId: 'guild-clan-only',
    ownershipType: 'clan',
    fishStock: [],
  });

  const lakeIds = await scheduledTasks.getPublicLakeIds();
  assert.deepEqual(lakeIds, ['guild-public-only']);

  await scheduledTasks.runHourlyMaintenance();

  const playerOnlyLake = await Lake.findOne({ guildId: 'guild-player-only' });
  const publicLake = await Lake.findOne({ guildId: 'guild-public-only' });
  const clanLake = await Lake.findOne({ guildId: 'guild-clan-only' });

  assert.equal(playerOnlyLake, null);
  assert.equal(
    publicLake.fishStock.reduce((total, fish) => total + fish.count, 0),
    500,
  );
  assert.equal(
    clanLake.fishStock.reduce((total, fish) => total + fish.count, 0),
    0,
  );
});

test('scheduled maintenance skips cleanly when there are no players or public lakes', async () => {
  const infoMessages = [];
  const originalInfo = logger.info;

  logger.info = (message) => {
    infoMessages.push(message);
  };

  try {
    await scheduledTasks.runDailyMaintenance();
    await scheduledTasks.runHourlyMaintenance();
  } finally {
    logger.info = originalInfo;
  }

  assert.ok(
    infoMessages.includes(
      'No players or public lakes found for daily maintenance.',
    ),
  );
  assert.ok(
    infoMessages.includes('No public lakes found for hourly maintenance.'),
  );
});

test('scheduled task logging summarizes successes and failures', async () => {
  const infoMessages = [];
  const errorMessages = [];
  const originalInfo = logger.info;
  const originalError = logger.error;

  logger.info = (message) => {
    infoMessages.push(message);
  };
  logger.error = (message) => {
    errorMessages.push(message);
  };

  try {
    await scheduledTasks.logJobResult(
      'Lake restock for lake lake-log',
      Promise.resolve({
        success: true,
        newFishCount: 5500,
        speciesCount: 10,
      }),
    );

    await scheduledTasks.logJobResult(
      'Global bank interest',
      Promise.resolve({
        success: false,
        message: 'No players found.',
      }),
    );
  } finally {
    logger.info = originalInfo;
    logger.error = originalError;
  }

  assert.deepEqual(infoMessages, [
    'Lake restock for lake lake-log: Restocked 5,500 fish across 10 species.',
  ]);
  assert.deepEqual(errorMessages, [
    'Global bank interest: No players found.',
  ]);
});

test('hourly maintenance restocks public lakes', async () => {
  await Lake.create({ guildId: 'guild-hourly', fishStock: [] });

  await scheduledTasks.runHourlyMaintenance();

  const lake = await Lake.findOne({ guildId: 'guild-hourly' });
  assert.equal(
    lake.fishStock.reduce((total, fish) => total + fish.count, 0),
    500,
  );
});

test('leaderboard queries return sorted guild rankings', async () => {
  const guildId = 'guild-leaderboards';

  await Player.create([
    { userId: 'cash-low', guildId, cash: 10, bank: 5, debt: 5 },
    { userId: 'cash-high', guildId, cash: 100, bank: 20, debt: 50 },
    { userId: 'bank-high', guildId, cash: 5, bank: 250, debt: 75 },
    { userId: 'debt-high', guildId, cash: 0, bank: 0, debt: 400 },
  ]);

  const cash = await getCashLeaderboard(guildId);
  const bank = await getBankLeaderboard(guildId);
  const debt = await getDebtLeaderboard(guildId);
  const netWorth = await getNetWorthLeaderboard(guildId);

  assert.deepEqual(
    cash.map((player) => player.userId),
    ['cash-high', 'cash-low', 'bank-high', 'debt-high'],
  );
  assert.deepEqual(
    bank.map((player) => player.userId),
    ['bank-high', 'cash-high', 'cash-low', 'debt-high'],
  );
  assert.deepEqual(
    debt.map((player) => player.userId),
    ['debt-high', 'bank-high', 'cash-high', 'cash-low'],
  );
  assert.deepEqual(
    netWorth.map((player) => player.userId),
    ['bank-high', 'cash-high', 'cash-low', 'debt-high'],
  );
});

test('player service returns all guild players for role sync flows', async () => {
  const guildId = 'guild-sync-service';

  await Player.create([
    { userId: 'sync-a', guildId, cash: 0, bank: 0, debt: 0, level: 3 },
    { userId: 'sync-b', guildId, cash: 0, bank: 0, debt: 0, level: 7 },
  ]);

  const players = await findPlayersByGuild(guildId, {
    select: 'userId level -_id',
    lean: true,
  });

  assert.deepEqual(
    players.map((player) => ({ userId: player.userId, level: player.level })),
    [
      { userId: 'sync-a', level: 3 },
      { userId: 'sync-b', level: 7 },
    ],
  );
});

test('leaderboard command skips deleted members and edits the deferred reply', async () => {
  const guildId = 'guild-leaderboard-command';

  await Player.create([
    { userId: 'active-member', guildId, cash: 90, bank: 0, debt: 0 },
    { userId: 'stale-member', guildId, cash: 80, bank: 0, debt: 0 },
  ]);

  let replyCalled = false;
  let deferCalled = false;
  let editReplyPayload;
  const interaction = {
    inGuild: () => true,
    guildId,
    options: {
      getSubcommand: () => 'cash',
    },
    deferReply: async () => {
      deferCalled = true;
    },
    guild: {
      members: {
        cache: new Map([
          [
            'active-member',
            {
              displayName: 'Active Member',
            },
          ],
        ]),
        fetch: async ({ user }) =>
          new Map(
            user
              .filter((userId) => userId === 'active-member')
              .map((userId) => [
                userId,
                {
                  displayName: 'Active Member',
                },
              ]),
          ),
      },
    },
    reply: async () => {
      replyCalled = true;
    },
    editReply: async (payload) => {
      editReplyPayload = payload;
    },
  };

  await leaderboardCommand.execute(interaction);

  assert.equal(deferCalled, true);
  assert.equal(replyCalled, false);
  assert.equal(editReplyPayload.embeds[0].data.title, '💵 Cash Leaderboard');
  assert.deepEqual(
    editReplyPayload.embeds[0].data.fields[0].name,
    '1. Active Member',
  );
  assert.equal(editReplyPayload.embeds[0].data.fields.length, 1);
});

test('blackjack command rejects invalid bets before starting a game', async () => {
  let replyPayload;
  const interaction = {
    inGuild: () => true,
    guildId: 'guild-blackjack-invalid',
    user: { id: 'blackjack-user', username: 'BlackjackUser' },
    options: {
      getInteger: () => 0,
    },
    member: {},
    reply: async (payload) => {
      replyPayload = payload;
    },
  };

  await require('../../src/commands/gamble/blackjack').execute(interaction);

  assert.equal(replyPayload.embeds[0].data.title, '🎲 Invalid Bet');
  assert.match(
    replyPayload.embeds[0].data.description,
    /Please enter a positive wager amount\./,
  );
});

test('admin economy give confirms through buttons before applying the change', async () => {
  const userId = 'admin-give-target';
  const guildId = 'guild-admin-give';

  await Player.create({
    userId,
    guildId,
    cash: 100,
    bank: 50,
    debt: 25,
  });

  let deferCalled = false;
  const replyUpdates = [];
  const interaction = {
    inGuild: () => true,
    guildId,
    commandName: 'economy',
    user: { id: 'admin-user', tag: 'Admin#0001' },
    member: {
      permissions: {
        has: () => true,
      },
    },
    channel: { name: 'general' },
    options: {
      getSubcommand: () => 'give',
      getUser: () => ({ id: userId, username: 'TargetUser' }),
      getString: (field) => (field === 'field' ? 'cash' : undefined),
      getInteger: (field) => (field === 'amount' ? 40 : undefined),
    },
    deferReply: async () => {
      deferCalled = true;
    },
    editReply: async (payload) => {
      replyUpdates.push(payload);
      if (replyUpdates.length === 1) {
        return createConfirmationReplyStub(replyUpdates, true);
      }
      return null;
    },
    followUp: async () => {},
  };

  await adminEconomyCommand.execute(interaction);

  const player = await Player.findOne({ userId, guildId });
  assert.equal(deferCalled, true);
  assert.equal(player.cash, 140);
  assert.equal(replyUpdates[0].embeds[0].data.title, '⚠️ Are you sure?');
  assert.equal(replyUpdates[1].embeds[0].data.title, '⏳ Applying Change');
  assert.equal(replyUpdates.at(-1).embeds[0].data.title, '✅ Balance Adjusted');
  assert.equal(replyUpdates.at(-1).components.length, 0);
});

test('admin confirmation previews stay explicit for destructive actions', () => {
  const setPreview = adminEconomyCommand.buildConfirmationPreview({
    channel: { name: 'general' },
    options: {
      getSubcommand: () => 'set',
      getUser: () => ({ id: 'target-user', username: 'TargetUser' }),
      getString: (field) => (field === 'field' ? 'cash' : undefined),
      getInteger: (field) => (field === 'amount' ? 500 : undefined),
    },
  });

  const airdropPreview = adminEconomyCommand.buildConfirmationPreview({
    channel: { name: 'trade-hall' },
    options: {
      getSubcommand: () => 'airdrop',
      getUser: () => null,
      getString: () => undefined,
      getInteger: (field) => (field === 'amount' ? 250 : undefined),
    },
  });

  assert.equal(setPreview.title, '⚠️ Are you sure?');
  assert.match(setPreview.description, /TargetUser's cash balance to \$500/);
  assert.equal(airdropPreview.title, '⚠️ Are you sure?');
  assert.match(airdropPreview.description, /give \$250 to every active member/);
  assert.deepEqual(
    airdropPreview.fields.map((field) => field.name),
    ['Target Channel', 'Amount'],
  );
});

test('admin economy handler returns a structured failure when dispatch throws', async () => {
  const economyHandler = require('../../src/modules/economy/adminOperations/economyHandler');
  const originalError = logger.error;
  logger.error = () => {};

  try {
    const response = await economyHandler({
      options: {
        getSubcommand() {
          throw new Error('dispatch failed');
        },
      },
    });

    assert.equal(response.success, false);
    assert.equal(
      response.error,
      'An unexpected error occurred while handling the economy action. Please try again later.',
    );
  } finally {
    logger.error = originalError;
  }
});

test('lake restock preview makes the target channel and size explicit', () => {
  const preview = adminRestockLakeCommand.buildConfirmationPreview(
    {
      channel: { name: 'fish-market' },
    },
    5500,
  );

  assert.equal(preview.title, '⚠️ Are you sure?');
  assert.match(preview.description, /#fish-market/);
  assert.deepEqual(
    preview.fields.map((field) => field.name),
    ['Target Channel', 'Lake Size'],
  );
});

test('lake restock confirms through buttons before applying the change', async () => {
  const guildId = 'guild-lake-confirm';

  let deferCalled = false;
  const replyUpdates = [];
  const interaction = {
    inGuild: () => true,
    guildId,
    commandName: 'restocklake',
    user: { id: 'admin-user', tag: 'Admin#0001' },
    member: {
      permissions: {
        has: () => true,
      },
    },
    channel: { name: 'fish-market' },
    options: {
      getInteger: (field) => (field === 'lake_size' ? 5500 : undefined),
    },
    deferReply: async () => {
      deferCalled = true;
    },
    editReply: async (payload) => {
      replyUpdates.push(payload);
      if (replyUpdates.length === 1) {
        return createConfirmationReplyStub(replyUpdates, true);
      }
      return null;
    },
  };

  await adminRestockLakeCommand.execute(interaction);

  const lake = await Lake.findOne({ guildId });
  assert.equal(deferCalled, true);
  assert.ok(lake);
  assert.equal(
    lake.fishStock.reduce((total, fish) => total + fish.count, 0),
    5500,
  );
  assert.equal(replyUpdates[0].embeds[0].data.title, '⚠️ Are you sure?');
  assert.equal(replyUpdates[1].embeds[0].data.title, '⏳ Applying Change');
  assert.equal(replyUpdates.at(-1).embeds[0].data.title, '🐟 Lake Restocked');
});

test('interaction error fallback is awaited when a command throws', async () => {
  const interactionCreate = require('../../src/events/interactionCreate');

  const interaction = {
    isChatInputCommand: () => true,
    commandName: 'boom',
    user: { id: 'user-1', tag: 'user#0001' },
    guildId: 'guild-1',
    guild: { id: 'guild-1', name: 'Guild One' },
    client: {
      commands: new Map([
        [
          'boom',
          {
            data: { name: 'boom' },
            cooldown: 0,
            async execute() {
              throw new Error('command failed');
            },
          },
        ],
      ]),
      cooldowns: new Map(),
    },
    options: { data: [] },
    reply() {
      return Promise.reject(new Error('reply failed'));
    },
    followUp() {
      return Promise.reject(new Error('follow up failed'));
    },
  };

  await assert.rejects(
    () => interactionCreate.execute(interaction),
    /reply failed/,
  );
});

test('lake restock persists the expected fish stock', async () => {
  const guildId = 'guild-lake';

  const result = await restockLake(guildId, 1000);
  assert.equal(result.success, true);
  assert.equal(result.newFishCount, 1000);

  const lake = await Lake.findOne({ guildId });
  assert.ok(lake);
  assert.equal(lake.ownershipType, 'public');
  assert.equal(lake.fishStock.length, 10);

  const totalStock = lake.fishStock.reduce(
    (total, fish) => total + fish.count,
    0,
  );
  assert.equal(totalStock, 1000);
});

test('lake restock preserves clan ownership metadata', async () => {
  const guildId = 'guild-clan-restock';

  await Lake.create({
    guildId,
    ownershipType: 'clan',
    fishStock: [],
  });

  const result = await restockLake(guildId, 1000);
  assert.equal(result.success, true);

  const lake = await Lake.findOne({ guildId });
  assert.ok(lake);
  assert.equal(lake.ownershipType, 'clan');
  assert.equal(
    lake.fishStock.reduce((total, fish) => total + fish.count, 0),
    1000,
  );
});

test('lake stock helper rejects negative stock transitions', async () => {
  const lake = await Lake.create({
    guildId: 'guild-stock-guard',
    fishStock: [{ type: 'Tilapia', count: 1, reward: 10 }],
  });

  const result = await lake.updateFishStock('Tilapia', -2, 10);
  assert.equal(result.success, false);
  assert.equal(result.message, 'Fish stock cannot go below zero.');

  const reloaded = await Lake.findOne({ guildId: 'guild-stock-guard' });
  assert.equal(reloaded.fishStock[0].count, 1);
});
