require('dotenv').config();
const {REST, Routes} = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const clientId = config.clientId;
const guildId = config.devServer;

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// for guild-based commands
rest
  .put(Routes.applicationGuildCommands(clientId, guildId), {body: []})
  .then(() => logger.info('Successfully deleted all guild commands.'))
  .catch(logger.error);
