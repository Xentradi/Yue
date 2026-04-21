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
    await replyGuildOnly(interaction, options.description, {
      title: options.title,
      flags: options.flags ?? MessageFlags.Ephemeral,
    });
    return false;
  }

  if (options.defer === true && typeof interaction.deferReply === 'function') {
    await interaction.deferReply(options.deferOptions);
  }

  return true;
}

function getOptionValue(interaction, methodName, ...names) {
  for (const name of names) {
    const value = interaction?.options?.[methodName]?.(name);
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

function getOptionUser(interaction, ...names) {
  return getOptionValue(interaction, 'getUser', ...names);
}

function getOptionInteger(interaction, ...names) {
  return getOptionValue(interaction, 'getInteger', ...names);
}

function getOptionString(interaction, ...names) {
  return getOptionValue(interaction, 'getString', ...names);
}

function getOptionBoolean(interaction, ...names) {
  return getOptionValue(interaction, 'getBoolean', ...names);
}

module.exports = {
  createGuildOnlyEmbed,
  deferGuildInteraction,
  getOptionBoolean,
  getOptionInteger,
  getOptionString,
  getOptionUser,
  replyGuildOnly,
};
