const { Events, Collection, MessageFlags } = require('discord.js');
const { convertToSeconds } = require('../utils/calculate');
const logger = require('../utils/logger');
const { createCommandMetrics } = require('../utils/commandTiming');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (
      typeof interaction.isAutocomplete === 'function' &&
      interaction.isAutocomplete()
    ) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command?.autocomplete) {
        return interaction.respond([]);
      }

      try {
        await command.autocomplete(interaction);
      } catch (err) {
        logger.error(
          `Error handling autocomplete for ${interaction.commandName}: ${err.stack}`,
        );
        if (typeof interaction.respond === 'function') {
          await interaction.respond([]).catch(() => {});
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    const commandName = command.data.name;
    const userId = interaction.user.id;
    const guildId = interaction.guildId ?? 'dm';

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
          content:
            `Please wait, you are on a cooldown for \`${commandName}\`. ` +
            `You can use it again <t:${expiredTimestamp}:R>.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // Try running the command
    const commandMetrics = createCommandMetrics(interaction);
    instrumentDiscordTiming(interaction, commandMetrics);
    try {
      logCommandInvocation(interaction);
      await command.execute(interaction, commandMetrics);
      commandMetrics.finish('completed');
    } catch (err) {
      commandMetrics.finish('failed', err.message);
      await handleCommandError(err, interaction);
    }
  },
};

function logCommandInvocation(interaction) {
  const args = flattenCommandOptions(interaction.options.data)
    .map((option) => `${option.name}: ${option.value}`)
    .join(', ');
  const argsString = args.length > 0 ? ` with arguments ${args}` : '';

  let logMessage;
  if (interaction.guild) {
    const guildName = interaction.guild.name;
    const guildId = interaction.guild.id;
    logMessage =
      `Command ${interaction.commandName} invoked by ` +
      `${interaction.user.tag}${argsString} in guild ${guildName} ` +
      `(ID: ${guildId})`;
  } else {
    logMessage =
      `Command ${interaction.commandName} invoked by ` +
      `${interaction.user.tag}${argsString} in a Direct Message`;
  }

  logger.info(logMessage);
}

function flattenCommandOptions(options = []) {
  return options.flatMap((option) => {
    if (option.options?.length) {
      return flattenCommandOptions(option.options);
    }

    if (option.value === undefined) {
      return [];
    }

    return [{ name: option.name, value: option.value }];
  });
}

async function handleCommandError(err, interaction) {
  logger.error(`Error executing ${interaction.commandName}: ${err.stack}`);
  logger.error(
    `Error context: commandName=${interaction.commandName}, userId=${
      interaction.user.id
    }, guildId=${interaction.guild ? interaction.guild.id : 'DM'}`,
  );

  const errorMessage = 'There was an error while executing this command!';
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content: errorMessage,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content: errorMessage,
      flags: MessageFlags.Ephemeral,
    });
  }
}

function instrumentDiscordTiming(interaction, commandMetrics) {
  if (!commandMetrics) {
    return;
  }

  wrapAsyncMethod(interaction, 'reply', commandMetrics, 'discord reply');
  wrapAsyncMethod(
    interaction,
    'deferReply',
    commandMetrics,
    'discord deferReply',
  );
  wrapAsyncMethod(
    interaction,
    'editReply',
    commandMetrics,
    'discord editReply',
  );
  wrapAsyncMethod(interaction, 'followUp', commandMetrics, 'discord followUp');
}

function wrapAsyncMethod(target, methodName, commandMetrics, label) {
  if (typeof target?.[methodName] !== 'function') {
    return;
  }

  const original = target[methodName].bind(target);
  target[methodName] = async (...args) => {
    const endStep = commandMetrics.step(label);
    try {
      return await original(...args);
    } finally {
      endStep();
    }
  };
}
