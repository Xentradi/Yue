require('dotenv').config();
const {Client, GatewayIntentBits} = require('discord.js');
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
    await mongoose.connect(process.env.DB_URL);
    logger.info('Connected to database.');
    eventHandler(client);
    commandHandler(client);
    client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error(err);
  }
})();
