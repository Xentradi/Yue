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
const restockLake = require('../../src/modules/games/adminOperations/restockLake');

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

test('admin airdrop credits all players in the guild', async () => {
  const guildId = 'guild-airdrop';

  await Player.create([
    { userId: 'airdrop-a', guildId, cash: 10, bank: 0, debt: 0 },
    { userId: 'airdrop-b', guildId, cash: 20, bank: 0, debt: 0 },
  ]);

  const result = await airdrop({
    guildId,
    options: {
      getInteger: () => 50,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.amount, 50);
  assert.equal(result.total, 100);

  const players = await Player.find({ guildId }).sort({ userId: 1 });
  assert.equal(players[0].cash, 60);
  assert.equal(players[1].cash, 70);
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
