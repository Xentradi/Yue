const config = require('../config.json');
const {PermissionFlagsBits} = require('discord.js');
const logger = require('../utils/logger');

/**
 * Manages roles based on the player's level.
 * Assigns a new role to the player and removes roles from previous levels.
 *
 * @async
 * @function
 * @param {GuildMember} member - The member to manage roles for.
 * @param {number} level - The current level of the player.
 * @returns {Promise<void>} Resolves when roles have been successfully managed.
 * @throws Will throw an error if there is an issue with role assignment or removal.
 */
module.exports.manageRoles = async function (member, level) {
  logger.debug(`manageRoles called for guildId: ${member.guild.id}`);
  logger.debug(`member.guild.members.me: ${member.guild.members.me}`);

  // Check if the bot has permissions to manage roles before doing anything.
  if (
    !member.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)
  ) {
    logger.warn(
      `Bot lacks the ManageRoles permission in guild ${member.guild.id}. Roles will not be issued.`
    );
    return;
  }

  // Check if the role exists in the guild
  const newRoleID = config.levelRoles[level.toString()];
  if (newRoleID) {
    const guild = member.guild;
    const newRole = guild.roles.cache.get(newRoleID);
    if (!newRole) {
      logger.error(
        `Role with ID ${newRoleID} does not exist in guild ${guild.id}`
      );
      return;
    }

    await member.roles.add(newRole).catch(logger.error);

    // Remove previous level roles
    for (const [lvl, roleID] of Object.entries(config.levelRoles)) {
      if (Number(lvl) < level) {
        const oldRole = guild.roles.cache.get(roleID);
        if (oldRole) {
          await member.roles.remove(oldRole).catch(logger.error);
        } else {
          logger.error(
            `Role with ID ${roleID} does not exist in guild ${guild.id}`
          );
        }
      }
    }
  }
};
