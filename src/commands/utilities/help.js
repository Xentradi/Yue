const path = require('node:path');
const fs = require('node:fs');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createStatusEmbed } = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List commands or get help for a specific command.'),
  cooldown: '5m',
  deployGlobal: true,

  async execute(interaction) {
    const foldersPath = path.join(__dirname, '../');
    const commandFolders = fs
      .readdirSync(foldersPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(
        (left, right) =>
          getFolderOrder(left) - getFolderOrder(right) ||
          left.localeCompare(right),
      );
    const canViewAdminCommands =
      interaction.inGuild() &&
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    const fields = [];

    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder);
      const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith('.js'))
        .sort();

      let commandList = '';

      for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        const isAdminCommand = folder.toLowerCase() === 'admin';

        if (command.data) {
          if (isAdminCommand && !canViewAdminCommands) {
            continue; // Skip admin commands for non-admin users
          }

          commandList += `${formatUsage(command.data)} - ${command.data.description}\n`;
        }
      }

      if (commandList) {
        fields.push({
          name: getFolderLabel(folder),
          value: commandList,
        });
      }
    }

    const embedOptions = {
      title: 'Available Commands',
      description:
        'Commands are grouped by category. Admin commands are hidden unless you have administrator permissions.',
      fields,
    };

    const helpEmbed = createStatusEmbed({
      ...embedOptions,
      color: '#0099ff',
    });

    await interaction.reply({ embeds: [helpEmbed] });
  },
};

function formatUsage(commandData) {
  const options = commandData.options ?? [];

  if (options.length === 0) {
    return `/${commandData.name}`;
  }

  const subcommands = options.filter((option) => option.type === 1);
  if (subcommands.length > 0) {
    return subcommands
      .map((subcommand) => {
        const subcommandOptions = subcommand.options ?? [];
        const optionText = subcommandOptions.length
          ? ` ${subcommandOptions
              .map((option) => formatOption(option))
              .join(' ')}`
          : '';
        return `/${commandData.name} ${subcommand.name}${optionText}`;
      })
      .join('\n');
  }

  return `/${commandData.name} ${options.map((option) => formatOption(option)).join(' ')}`;
}

function formatOption(option) {
  const wrapper = option.required ? '<' : '[';
  const closer = option.required ? '>' : ']';
  return `${wrapper}${option.name}${closer}`;
}

function getFolderLabel(folder) {
  const labels = {
    admin: 'Admin',
    economy: 'Economy',
    gamble: 'Games',
    utilities: 'Utilities',
  };

  return labels[folder] ?? folder.charAt(0).toUpperCase() + folder.slice(1);
}

function getFolderOrder(folder) {
  const order = {
    economy: 0,
    gamble: 1,
    utilities: 2,
    admin: 3,
  };

  return order[folder] ?? 99;
}
