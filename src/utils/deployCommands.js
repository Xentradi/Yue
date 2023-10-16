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

    // Separate commands into global and guild-specific
    const globalCommands = commands
      .filter(cmd => cmd.deployGlobal)
      .map(cmd => cmd.data);

    const guildCommands = commands
      .filter(cmd => !cmd.deployGlobal)
      .map(cmd => cmd.data);

    // Deploy global commands
    if (globalCommands.length > 0) {
      await rest.put(Routes.applicationCommands(clientId), {
        body: globalCommands,
      });
      console.log(`Deployed ${globalCommands.length} global commands.`);
    }

    // Deploy guild-specific commands
    if (guildCommands.length > 0) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: guildCommands,
      });
      console.log(`Deployed ${guildCommands.length} guild-specific commands.`);
    }

    console.log(
      `Successfully reloaded ${commands.length} application (/) commands.`
    );
  } catch (err) {
    console.error(err);
  }
})();
