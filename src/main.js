require('dotenv').config();
const {Client, GatewayIntentBits, Collection} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const eventHandler = require('./handlers/eventHandler');
const commandHandler = require('./handlers/commandHandler');

const {Users, CurrencyShop} = require('./db/dbObjects.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

eventHandler(client);
commandHandler(client);

client.currency = new Collection();

client.login(process.env.DISCORD_TOKEN);
