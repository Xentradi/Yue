const {Events, Collection} = require('discord.js');
const {convertToSeconds} = require('../utils/calculate');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    const commandName = command.data.name;
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const cooldownKey = `${commandName}_${guildId}_${userId}`;

    if (!interaction.client.cooldowns.has(cooldownKey)) {
      interaction.client.cooldowns.set(cooldownKey, new Collection());
    }

    const cooldownConfigured = convertToSeconds(command.cooldown);
    const now = Date.now();
    const timestamps = interaction.client.cooldowns.get(cooldownKey);
    const defaultCooldownDuration = 3;
    const cooldownAmount =
      (cooldownConfigured ?? defaultCooldownDuration) * 1000;

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId) + cooldownAmount;

      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1000);
        return interaction.reply({
          content: `Please wait, you are on a cooldown for \`${commandName}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
      }
    }
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // Try running the command
    try {
      logCommandInvocation(interaction);
      await command.execute(interaction);
    } catch (err) {
      handleCommandError(err, interaction);
    }
  },
};

function logCommandInvocation(interaction) {
  const args = interaction.options._hoistedOptions
    .map(option => `${option.name}: ${option.value}`)
    .join(', ');
  const argsString = args.length > 0 ? ` with arguements ${args}` : '';

  let logMessage;
  if (interaction.guild) {
    const guildName = interaction.guild.name;
    const guildId = interaction.guild.id;
    logMessage = `Command ${interaction.commandName} invoked by ${interaction.user.tag}${argsString} in guild ${guildName} (ID: ${guildId})`;
  } else {
    logMessage = `Command ${interaction.commandName} invoked by ${interaction.user.tag}${argsString} in a Direct Message`;
  }

  logger.info(logMessage);
}

async function handleCommandError(err, interaction) {
  logger.error(`Error executing ${interaction.commandName}: ${err.stack}`);
  logger.error(
    `Error context: commandName=${interaction.commandName}, userId=${
      interaction.user.id
    }, guildId=${interaction.guild ? interaction.guild.id : 'DM'}`
  );

  const errorMessage = 'There was an error while executing this command!';
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({content: errorMessage, ephemeral: true});
  } else {
    await interaction.reply({content: errorMessage, ephemeral: true});
  }
}
