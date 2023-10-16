require('dotenv').config();
const {REST, Routes} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config.json');
const clientId = config.clientId;
const guildId = config.homeServer;

const commands = [];

const foldersPath = path.join(__dirname, '../commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push({
        data: command.data.toJSON(),
        deployGlobal: command.deployGlobal, // Save the deployGlobal property
      });
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    for (const command of commands) {
      if (command.deployGlobal) {
        // Deploy command globally
        await rest.put(Routes.applicationCommands(clientId), {
          body: [command.data],
        });
      } else {
        // Deploy command to specific guild
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: [command.data],
        });
      }
    }

    console.log(
      `Successfully reloaded ${commands.length} application (/) commands.`
    );
  } catch (err) {
    console.error(err);
  }
})();
