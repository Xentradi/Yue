require('dotenv').config();
const {REST, Routes} = require('discord.js');
const config = require('../config.json');
const clientId = config.clientId;
const guildId = config.homeServer;

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// for guild-based commands
rest
  .put(Routes.applicationGuildCommands(clientId, guildId), {body: []})
  .then(() => console.log('Successfully deleted all guild commands.'))
  .catch(console.error);
