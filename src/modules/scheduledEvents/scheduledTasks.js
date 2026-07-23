const cron = require('node-cron');
const Player = require('../../models/Player');
const Lake = require('../../models/Lake');
const { query } = require('../../storage/postgres');
const applyBankInterest = require('../economy/bankOperations/interest');
const loanLifecycleService = require('../economy/loanLifecycleService');
const restockLake = require('../games/adminOperations/restockLake');
const logger = require('../../utils/logger');

const DEFAULT_DAILY_MAINTENANCE_CRON = '0 12 * * *';
const DEFAULT_HOURLY_MAINTENANCE_CRON = '0 * * * *';
const DEFAULT_HOURLY_LOAN_LIFECYCLE_CRON = '15 * * * *';
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
const HOURLY_LOAN_LIFECYCLE_CRON = readCronExpression(
  'HOURLY_LOAN_LIFECYCLE_CRON',
  DEFAULT_HOURLY_LOAN_LIFECYCLE_CRON,
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
    getTrackedPlayerIds(),
    getPublicLakeIds(),
  ]);

  return [...new Set([...playerGuildIds, ...lakeGuildIds].filter(Boolean))];
}

async function getTrackedPlayerIds() {
  const guildIds = await Player.distinct('guildId');
  return [...new Set(guildIds.filter(Boolean))];
}

async function getPlayerGuildIds() {
  return await getTrackedPlayerIds();
}

async function getPublicLakeIds() {
  const guildIds = await Lake.distinct('guildId', { ownershipType: 'public' });
  return [...new Set(guildIds.filter(Boolean))];
}

async function getLakeGuildIds() {
  return await getPublicLakeIds();
}

async function countPlayerRecords() {
  const { rows } = await query(`
    SELECT COUNT(*)::int AS player_count
    FROM player_economy;
  `);

  return rows[0]?.player_count ?? 0;
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
  const [publicLakeIds, playerCount] = await Promise.all([
    getPublicLakeIds(),
    countPlayerRecords(),
  ]);

  if (publicLakeIds.length === 0 && playerCount === 0) {
    logger.info('No players or public lakes found for daily maintenance.');
    return;
  }

  logger.info(
    `Running daily maintenance for ${playerCount.toLocaleString()} player record(s) with bank interest and ${publicLakeIds.length.toLocaleString()} public lake(s) with lake restocks.`,
  );

  if (playerCount > 0) {
    await logJobResult('Global bank interest', applyBankInterest());
  }

  await runLakeRestockMaintenance(
    publicLakeIds,
    DAILY_LAKE_RESTOCK_SIZE,
    'Public lake restock',
  );
}

async function runHourlyMaintenance() {
  const publicLakeIds = await getPublicLakeIds();

  if (publicLakeIds.length === 0) {
    logger.info('No public lakes found for hourly maintenance.');
    return;
  }

  logger.info(
    `Running hourly maintenance for ${publicLakeIds.length} public lake(s) with lake restock size ${HOURLY_LAKE_RESTOCK_SIZE.toLocaleString()}.`,
  );

  await runLakeRestockMaintenance(
    publicLakeIds,
    HOURLY_LAKE_RESTOCK_SIZE,
    'Hourly public lake restock',
  );
}

async function runLoanLifecycleMaintenance() {
  const result = await loanLifecycleService.runLoanLifecycleMaintenance();
  await logJobResult('Loan lifecycle maintenance', Promise.resolve(result));
  return result;
}

async function runLakeRestockMaintenance(lakeIds, size, jobLabel) {
  for (const lakeId of lakeIds) {
    await logJobResult(
      `${jobLabel} for lake ${lakeId}`,
      restockLake(lakeId, size),
    );
  }
}

function registerScheduledTasks() {
  logger.info(
    `Registering scheduled maintenance jobs: daily=${DAILY_MAINTENANCE_CRON}, hourly=${HOURLY_MAINTENANCE_CRON}, loanLifecycle=${HOURLY_LOAN_LIFECYCLE_CRON}, timezone=${MAINTENANCE_TIMEZONE}, dailyRestock=${DAILY_LAKE_RESTOCK_SIZE.toLocaleString()}, hourlyRestock=${HOURLY_LAKE_RESTOCK_SIZE.toLocaleString()}.`,
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

  cron.schedule(
    HOURLY_LOAN_LIFECYCLE_CRON,
    () => {
      void runLoanLifecycleMaintenance();
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
  getTrackedPlayerIds,
  getPlayerGuildIds,
  getPublicLakeIds,
  getLakeGuildIds,
  logJobResult,
  DAILY_MAINTENANCE_CRON,
  HOURLY_MAINTENANCE_CRON,
  HOURLY_LOAN_LIFECYCLE_CRON,
  MAINTENANCE_TIMEZONE,
  DAILY_LAKE_RESTOCK_SIZE,
  HOURLY_LAKE_RESTOCK_SIZE,
  runDailyMaintenance,
  runLakeRestockMaintenance,
  runHourlyMaintenance,
  runLoanLifecycleMaintenance,
  registerScheduledTasks,
};
