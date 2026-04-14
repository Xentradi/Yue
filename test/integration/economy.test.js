const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Player = require('../../src/models/Player');
const Lake = require('../../src/models/Lake');
const config = require('../../src/config.json');
const dailyBonus = require('../../src/modules/economy/bonuses/dailyBonus');
const deposit = require('../../src/modules/economy/bankOperations/deposit');
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
