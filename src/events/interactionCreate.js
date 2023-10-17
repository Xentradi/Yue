const {Events, Collection} = require('discord.js');
const {convertToSeconds} = require('../utils/calculate');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
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
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    }
  },
};
