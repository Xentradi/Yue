require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const eventHandler = require('./handlers/eventHandler');
const commandHandler = require('./handlers/commandHandler');
const logger = require('./utils/logger');

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
    await mongoose.connect(process.env.DB_URL);
    logger.info('Connected to database.');
    eventHandler(client);
    commandHandler(client);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  }
})();

function validateEnvironment() {
  const requiredVars = ['DB_URL', 'DISCORD_TOKEN'];
  const missing = requiredVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}
