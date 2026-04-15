const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Player = require('../../src/models/Player');
const Lake = require('../../src/models/Lake');
const config = require('../../src/config.json');
const dailyBonus = require('../../src/modules/economy/bonuses/dailyBonus');
const deposit = require('../../src/modules/economy/bankOperations/deposit');
const applyBankInterest = require('../../src/modules/economy/bankOperations/interest');
const airdrop = require('../../src/modules/economy/adminOperations/airdrop');
const giveBalance = require('../../src/modules/economy/adminOperations/giveBalance');
const setBalance = require('../../src/modules/economy/adminOperations/setBalance');
const repayLoan = require('../../src/modules/economy/loans/repayLoan');
const withdraw = require('../../src/modules/economy/bankOperations/withdraw');
const giveCash = require('../../src/modules/economy/tranfers/giveCash');
const stealCash = require('../../src/modules/economy/tranfers/stealCash');
const scheduledTasks = require('../../src/modules/scheduledEvents/scheduledTasks');
const restockLake = require('../../src/modules/games/adminOperations/restockLake');
const getCashLeaderboard = require('../../src/modules/economy/leaderboards/cashLeaderboard');
const getBankLeaderboard = require('../../src/modules/economy/leaderboards/bankLeaderboard');
const getDebtLeaderboard = require('../../src/modules/economy/leaderboards/debtLeaderboard');
const getNetWorthLeaderboard = require('../../src/modules/economy/leaderboards/netWorthLeaderboard');
const leaderboardCommand = require('../../src/commands/economy/leaderboard');
const adminEconomyCommand = require('../../src/commands/admin/economy');

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), {
    dbName: 'yue-test',
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  await Promise.all([Player.deleteMany({}), Lake.deleteMany({})]);
});

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

test('bank interest only touches the targeted guild', async () => {
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

  const result = await applyBankInterest('guild-one');
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
  assert.equal(guildTwo.bank, 3000);
  assert.equal(guildTwo.debt, 2000);
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

test('steal cash returns a clear error when the target player is missing', async () => {
  const result = await stealCash(
    'missing-thief',
    'missing-target',
    'guild-steal',
    50,
  );

  assert.equal(result.successful, false);
  assert.equal(result.message, 'Stealing player not found.');
});

test('scheduled maintenance updates player guilds and lake-only guilds', async () => {
  await Player.create([
    {
      userId: 'maintenance-player',
      guildId: 'guild-player',
      cash: 0,
      bank: 2000,
      debt: 1000,
    },
  ]);

  await Lake.create([
    { guildId: 'guild-player', fishStock: [] },
    { guildId: 'guild-lake-only', fishStock: [] },
  ]);

  const trackedGuilds = await scheduledTasks.getTrackedGuildIds();
  assert.deepEqual(trackedGuilds.sort(), ['guild-lake-only', 'guild-player']);

  await scheduledTasks.runDailyMaintenance();

  const player = await Player.findOne({
    userId: 'maintenance-player',
    guildId: 'guild-player',
  });
  const playerLake = await Lake.findOne({ guildId: 'guild-player' });
  const lakeOnly = await Lake.findOne({ guildId: 'guild-lake-only' });

  assert.ok(player.bank > 2000);
  assert.ok(player.debt > 1000);
  assert.equal(
    playerLake.fishStock.reduce((total, fish) => total + fish.count, 0),
    5500,
  );
  assert.equal(
    lakeOnly.fishStock.reduce((total, fish) => total + fish.count, 0),
    5500,
  );
});

test('hourly maintenance restocks lake-only guilds', async () => {
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

test('leaderboard command skips deleted members and replies with active names only', async () => {
  const guildId = 'guild-leaderboard-command';

  await Player.create([
    { userId: 'active-member', guildId, cash: 90, bank: 0, debt: 0 },
    { userId: 'stale-member', guildId, cash: 80, bank: 0, debt: 0 },
  ]);

  let replyPayload;
  const interaction = {
    inGuild: () => true,
    guildId,
    options: {
      getSubcommand: () => 'cash',
    },
    client: {
      guilds: {
        fetch: async () => ({
          members: {
            fetch: async (userId) => {
              if (userId === 'active-member') {
                return { displayName: 'Active Member' };
              }

              throw new Error('Unknown member');
            },
          },
        }),
      },
    },
    reply: async (payload) => {
      replyPayload = payload;
    },
  };

  await leaderboardCommand.execute(interaction);

  assert.equal(replyPayload.embeds[0].data.title, '💵 Cash Leaderboard');
  assert.deepEqual(
    replyPayload.embeds[0].data.fields[0].name,
    '1. Active Member',
  );
  assert.equal(replyPayload.embeds[0].data.fields.length, 1);
});

test('admin confirmation previews stay explicit for destructive actions', () => {
  const setPreview = adminEconomyCommand.buildConfirmationPreview({
    options: {
      getSubcommand: () => 'set',
      getUser: () => ({ id: 'target-user', username: 'TargetUser' }),
      getString: (field) => (field === 'field' ? 'cash' : undefined),
      getInteger: (field) => (field === 'amount' ? 500 : undefined),
    },
  });

  const airdropPreview = adminEconomyCommand.buildConfirmationPreview({
    options: {
      getSubcommand: () => 'airdrop',
      getUser: () => null,
      getString: () => undefined,
      getInteger: (field) => (field === 'amount' ? 250 : undefined),
    },
  });

  assert.equal(setPreview.title, '⚠️ Confirm Balance Set');
  assert.match(setPreview.description, /TargetUser's cash balance to \$500/);
  assert.equal(airdropPreview.title, '⚠️ Confirm Airdrop');
  assert.match(airdropPreview.description, /give \$250 to every active member/);
});

test('lake restock persists the expected fish stock', async () => {
  const guildId = 'guild-lake';

  const result = await restockLake(guildId, 1000);
  assert.equal(result.success, true);
  assert.equal(result.newFishCount, 1000);

  const lake = await Lake.findOne({ guildId });
  assert.ok(lake);
  assert.equal(lake.fishStock.length, 10);

  const totalStock = lake.fishStock.reduce(
    (total, fish) => total + fish.count,
    0,
  );
  assert.equal(totalStock, 1000);
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
