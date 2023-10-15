const {EmbedBuilder} = require('discord.js');

/**
 * Creates a customized embed for various commands.
 *
 * @param {Object} options - Configuration for the embed.
 * @param {string} options.title - The title of the embed.
 * @param {string} [options.thumbnail] - URL for the embed's thumbnail. Defaults to a preset thumbnail if not provided.
 * @param {string} [options.description] - Description text for the embed.
 * @param {Array<{name: string, value: string}>} [options.fields] - Fields to be added to the embed. An array of objects where each object represents a field with a name and value.
 *
 * @returns {EmbedBuilder} - The customized embed.
 */

function createEmbed(options) {
  const embed = new EmbedBuilder()
    .setTitle(options.title)
    .setColor(options.color || '#a8dadc')
    /*
    .setThumbnail(
      options.thumbnail ||
        'https://cdn.discordapp.com/icons/1144324605599830086/75b1d6fd9acf20c5f0023001ad5d3ad7.webp?size=100'
    )
    */
    .setTimestamp();
  //.setFooter({text: 'Yue Bank Corp.'});

  if (options.description) {
    embed.setDescription(options.description);
  }

  if (options.fields) {
    embed.addFields(options.fields);
  }

  return embed;
}

module.exports = {
  createEmbed,
};
