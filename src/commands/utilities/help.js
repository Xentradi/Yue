// src/commands/utilities/help.js
const path = require('node:path');
const fs = require('node:fs');
const {SlashCommandBuilder} = require('discord.js');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all commands or info about a specific command'),
  cooldown: '5m',
  deployGlobal: true,

  async execute(interaction) {
    const foldersPath = path.join(__dirname, '../'); // Adjust the path as needed
    const commandFolders = fs.readdirSync(foldersPath);

    const fields = [];

    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder);
      const commandFiles = fs
        .readdirSync(commandsPath)
        .filter(file => file.endsWith('.js'));

      let commandList = ''; // This will hold the list of commands in the current folder

      for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        const isAdminCommand = folder.toLowerCase() === 'admin';

        if (command.data) {
          if (
            isAdminCommand &&
            !interaction.member.permissions.has('ADMINISTRATOR')
          ) {
            continue; // Skip admin commands for non-admin users
          }

          const commandName = isAdminCommand
            ? `/${command.data.name} `
            : `/${command.data.name}`;
          commandList += `${commandName} - ${command.data.description}\n`;
        }
      }

      // If the commandList is not empty after going through all files, add it as a field
      if (commandList) {
        fields.push({
          name: folder.charAt(0).toUpperCase() + folder.slice(1),
          value: commandList,
        });
      }
    }

    const embedOptions = {
      title: 'Available Commands',
      description: 'List of all available commands grouped by category:',
      fields,
    };

    const helpEmbed = createEmbed(embedOptions);

    await interaction.reply({embeds: [helpEmbed]});
  },
};
