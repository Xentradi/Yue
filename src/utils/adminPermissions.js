const { PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

function isDeveloperUserId(userId) {
  return (
    typeof userId === 'string' &&
    Array.isArray(config.devs) &&
    config.devs.includes(userId)
  );
}

function isAdministratorMember(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function canUseAdminCommands(interaction) {
  return (
    isAdministratorMember(interaction?.member) ||
    isDeveloperUserId(interaction?.user?.id)
  );
}

function canViewAdminCommands(interaction) {
  return Boolean(interaction?.inGuild?.()) && canUseAdminCommands(interaction);
}

module.exports = {
  canUseAdminCommands,
  canViewAdminCommands,
  isAdministratorMember,
  isDeveloperUserId,
};
