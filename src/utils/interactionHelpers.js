const { MessageFlags } = require('discord.js');
const { createStatusEmbed } = require('./economyFeedback');

function createGuildOnlyEmbed(description, title = '❌ Guild Only') {
  return createStatusEmbed({
    title,
    description,
    color: '#FF3333',
  });
}

async function replyGuildOnly(interaction, description, options = {}) {
  return interaction.reply({
    embeds: [createGuildOnlyEmbed(description, options.title)],
    flags: options.flags ?? MessageFlags.Ephemeral,
  });
}

async function deferGuildInteraction(interaction, options = {}) {
  if (!interaction.inGuild()) {
    return replyGuildOnly(interaction, options.description, {
      title: options.title,
      flags: options.flags ?? MessageFlags.Ephemeral,
    });
  }

  if (options.defer === true && typeof interaction.deferReply === 'function') {
    await interaction.deferReply(options.deferOptions);
  }

  return true;
}

module.exports = {
  createGuildOnlyEmbed,
  deferGuildInteraction,
  replyGuildOnly,
};
