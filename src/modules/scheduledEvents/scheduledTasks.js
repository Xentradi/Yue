const cron = require('node-cron');
const Player = require('../../models/Player');
const Lake = require('../../models/Lake');
const applyBankInterest = require('../economy/bankOperations/interest');
const restockLake = require('../games/adminOperations/restockLake');
const logger = require('../../utils/logger');

async function getTrackedGuildIds() {
  const [playerGuildIds, lakeGuildIds] = await Promise.all([
    Player.distinct('guildId'),
    Lake.distinct('guildId'),
  ]);

  return [...new Set([...playerGuildIds, ...lakeGuildIds].filter(Boolean))];
}

async function getPlayerGuildIds() {
  const guildIds = await Player.distinct('guildId');
  return [...new Set(guildIds.filter(Boolean))];
}

async function logJobResult(jobName, promise) {
  try {
    const result = await promise;
    if (result?.success) {
      logger.info(result.message);
    } else {
      logger.error(`${jobName}: ${result?.message ?? 'Unknown failure.'}`);
    }
  } catch (error) {
    logger.error(`${jobName}: ${error}`);
  }
}

async function runDailyMaintenance() {
  const [guildIds, playerGuildIds] = await Promise.all([
    getTrackedGuildIds(),
    getPlayerGuildIds(),
  ]);

  if (guildIds.length === 0) {
    logger.info('No guilds found for daily maintenance.');
    return;
  }

  for (const guildId of playerGuildIds) {
    await logJobResult(
      `Bank interest for guild ${guildId}`,
      applyBankInterest(guildId),
    );
  }

  for (const guildId of guildIds) {
    await logJobResult(
      `Lake restock for guild ${guildId}`,
      restockLake(guildId, 5500),
    );
  }
}

async function runHourlyMaintenance() {
  const guildIds = await getTrackedGuildIds();

  if (guildIds.length === 0) {
    logger.info('No guilds found for hourly maintenance.');
    return;
  }

  for (const guildId of guildIds) {
    await logJobResult(
      `Hourly lake restock for guild ${guildId}`,
      restockLake(guildId, 500),
    );
  }
}

// Daily
cron.schedule(
  '0 12 * * *',
  () => {
    void runDailyMaintenance();
  },
  {
    scheduled: true,
    timezone: 'Etc/UTC',
  },
);

// Hourly
cron.schedule(
  '0 * * * *',
  () => {
    void runHourlyMaintenance();
  },
  {
    scheduled: true,
    timezone: 'Etc/UTC',
  },
);

// Daily
