require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const eventHandler = require('./handlers/eventHandler');
const commandHandler = require('./handlers/commandHandler');
const deployCommands = require('./registerCommands/deployCommands');
const logger = require('./utils/logger');
const { ensureSchema } = require('./storage/postgres');
const cache = require('./storage/cache');
const { isCommandDeployEnabled } = require('./utils/startupConfig');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

(async () => {
  try {
    validateEnvironment();
    await ensureSchema();
    if (cache.isEnabled()) {
      const redisClient = await cache.getClient();
      if (redisClient) {
        logger.info('Redis cache enabled.');
      } else {
        logger.warn(
          'Redis cache connection could not be established. Continuing without cache.',
        );
      }
    } else {
      logger.info(
        'Redis cache disabled. Set REDIS_URL to enable versioned cache support.',
      );
    }
    logger.info('Connected to PostgreSQL and ensured schema.');
    eventHandler(client);
    commandHandler(client);
    if (isCommandDeployEnabled()) {
      await deployCommands().catch((err) => {
        logger.error(`Automatic command deployment failed: ${err}`);
      });
    } else {
      logger.info(
        'Automatic command deployment disabled for this startup. Set DEPLOY_COMMANDS_ON_STARTUP=1 to enable it.',
      );
    }
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  }
})();

function validateEnvironment() {
  const missing = [];

  if (!process.env.DB_URL?.trim()) {
    missing.push('DB_URL');
  }

  if (!process.env.DISCORD_TOKEN) {
    missing.push('DISCORD_TOKEN');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}
