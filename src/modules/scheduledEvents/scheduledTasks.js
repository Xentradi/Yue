const cron = require('node-cron');
const Player = require('../../models/Player');
const Lake = require('../../models/Lake');
const applyBankInterest = require('../economy/bankOperations/interest');
const restockLake = require('../games/adminOperations/restockLake');
const logger = require('../../utils/logger');

const DEFAULT_DAILY_MAINTENANCE_CRON = '0 12 * * *';
const DEFAULT_HOURLY_MAINTENANCE_CRON = '0 * * * *';
const DEFAULT_MAINTENANCE_TIMEZONE = 'Etc/UTC';
const DEFAULT_DAILY_LAKE_RESTOCK_SIZE = 5500;
const DEFAULT_HOURLY_LAKE_RESTOCK_SIZE = 500;

const DAILY_MAINTENANCE_CRON = readCronExpression(
  'DAILY_MAINTENANCE_CRON',
  DEFAULT_DAILY_MAINTENANCE_CRON,
);
const HOURLY_MAINTENANCE_CRON = readCronExpression(
  'HOURLY_MAINTENANCE_CRON',
  DEFAULT_HOURLY_MAINTENANCE_CRON,
);
const MAINTENANCE_TIMEZONE =
  process.env.MAINTENANCE_TIMEZONE?.trim() || DEFAULT_MAINTENANCE_TIMEZONE;
const DAILY_LAKE_RESTOCK_SIZE = readPositiveIntegerEnv(
  'DAILY_LAKE_RESTOCK_SIZE',
  DEFAULT_DAILY_LAKE_RESTOCK_SIZE,
);
const HOURLY_LAKE_RESTOCK_SIZE = readPositiveIntegerEnv(
  'HOURLY_LAKE_RESTOCK_SIZE',
  DEFAULT_HOURLY_LAKE_RESTOCK_SIZE,
);

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
      logger.info(`${jobName}: ${describeSuccess(result)}`);
    } else {
      logger.error(`${jobName}: ${result?.message ?? 'Unknown failure.'}`);
    }
  } catch (error) {
    logger.error(`${jobName}: ${error?.stack ?? error}`);
  }
}

async function runDailyMaintenance() {
  const [guildIds, playerGuildIds] = await Promise.all([
    getTrackedGuildIds(),
    getPlayerGuildIds(),
  ]);

  if (guildIds.length === 0 && playerGuildIds.length === 0) {
    logger.info('No guilds found for daily maintenance.');
    return;
  }

  logger.info(
    `Running daily maintenance for ${playerGuildIds.length} guild(s) with bank interest and ${guildIds.length} tracked guild(s) with lake restocks.`,
  );

  if (playerGuildIds.length > 0) {
    for (const guildId of playerGuildIds) {
      await logJobResult(
        `Bank interest for guild ${guildId}`,
        applyBankInterest(guildId),
      );
    }
  }

  if (guildIds.length > 0) {
    for (const guildId of guildIds) {
      await logJobResult(
        `Lake restock for guild ${guildId}`,
        restockLake(guildId, DAILY_LAKE_RESTOCK_SIZE),
      );
    }
  }
}

async function runHourlyMaintenance() {
  const guildIds = await getTrackedGuildIds();

  if (guildIds.length === 0) {
    logger.info('No guilds found for hourly maintenance.');
    return;
  }

  logger.info(
    `Running hourly maintenance for ${guildIds.length} guild(s) with lake restock size ${HOURLY_LAKE_RESTOCK_SIZE.toLocaleString()}.`,
  );

  for (const guildId of guildIds) {
    await logJobResult(
      `Hourly lake restock for guild ${guildId}`,
      restockLake(guildId, HOURLY_LAKE_RESTOCK_SIZE),
    );
  }
}

function registerScheduledTasks() {
  logger.info(
    `Registering scheduled maintenance jobs: daily=${DAILY_MAINTENANCE_CRON}, hourly=${HOURLY_MAINTENANCE_CRON}, timezone=${MAINTENANCE_TIMEZONE}, dailyRestock=${DAILY_LAKE_RESTOCK_SIZE.toLocaleString()}, hourlyRestock=${HOURLY_LAKE_RESTOCK_SIZE.toLocaleString()}.`,
  );

  cron.schedule(
    DAILY_MAINTENANCE_CRON,
    () => {
      void runDailyMaintenance();
    },
    {
      scheduled: true,
      timezone: MAINTENANCE_TIMEZONE,
    },
  );

  cron.schedule(
    HOURLY_MAINTENANCE_CRON,
    () => {
      void runHourlyMaintenance();
    },
    {
      scheduled: true,
      timezone: MAINTENANCE_TIMEZONE,
    },
  );
}

function readCronExpression(envName, fallback) {
  const expression = process.env[envName]?.trim();
  if (!expression) {
    return fallback;
  }

  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression in ${envName}: ${expression}`);
  }

  return expression;
}

function readPositiveIntegerEnv(envName, fallback) {
  const rawValue = process.env[envName]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer in ${envName}: ${rawValue}`);
  }

  return parsed;
}

function describeSuccess(result) {
  if (typeof result.updatedCount === 'number') {
    return `Updated ${result.updatedCount.toLocaleString()} player(s); skipped ${result.skippedCount ?? 0} invalid record(s).`;
  }

  if (typeof result.newFishCount === 'number') {
    const speciesCount =
      typeof result.speciesCount === 'number' ? result.speciesCount : 10;
    return `Restocked ${result.newFishCount.toLocaleString()} fish across ${speciesCount} species.`;
  }

  return result.message ?? 'Completed successfully.';
}

module.exports = {
  getTrackedGuildIds,
  getPlayerGuildIds,
  logJobResult,
  DAILY_MAINTENANCE_CRON,
  HOURLY_MAINTENANCE_CRON,
  MAINTENANCE_TIMEZONE,
  DAILY_LAKE_RESTOCK_SIZE,
  HOURLY_LAKE_RESTOCK_SIZE,
  runDailyMaintenance,
  runHourlyMaintenance,
  registerScheduledTasks,
};
