const getBalance = require('./getBalance');
const setBalance = require('./setBalance');
const giveBalance = require('./giveBalance');
const resetBalance = require('./resetBalance');
const airdrop = require('./airdrop');

/**
 * Handles economy admin actions such as setting, giving, resetting balances and airdrop.
 * @param {import('discord.js').CommandInteraction} interaction - The interaction that triggered the command.
 * @returns {Promise<import('discord.js').MessageEmbed>} - A promise containing the embed to be sent as a reply.
 */
module.exports = async function economyHandler(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'get':
        return await getBalance(interaction);
      case 'set':
        return await setBalance(interaction);

      case 'give':
        return await giveBalance(interaction);

      case 'reset':
        return await resetBalance(interaction);

      case 'airdrop':
        return await airdrop(interaction);

      default:
        throw new Error('Invalid subcommand.');
    }
  } catch (error) {
    // Log the error and return a user-friendly message
    console.error(error);
    return {
      title: '❌ An error occurred',
      description:
        'An unexpected error occurred while handling the economy action. Please try again later.',
      color: '#FF0000',
    };
  }
};
