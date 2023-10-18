const config = require('../config.json');

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
  const newRoleID = config.levelRoles[level.toString()];
  if (newRoleID) {
    const guild = member.guild;
    const newRole = guild.roles.cache.get(newRoleID);
    if (!newRole) {
      console.error(
        `Role with ID ${newRoleID} does not exist in guild ${guild.id}`
      );
      return;
    }
    if (!guild.me.permissions.has('MANAGE_ROLES')) {
      console.error('Bot lacks the MANAGE_ROLES permission');
      return;
    }
    await member.roles.add(newRole).catch(console.error);

    // Remove previous level roles
    for (const [lvl, roleID] of Object.entries(config.levelRoles)) {
      if (Number(lvl) < level) {
        const oldRole = guild.roles.cache.get(roleID);
        if (oldRole) {
          await member.roles.remove(oldRole).catch(console.error);
        } else {
          console.error(
            `Role with ID ${roleID} does not exist in guild ${guild.id}`
          );
        }
      }
    }
  }
};
