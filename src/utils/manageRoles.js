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
    const newRole = member.guild.roles.cache.get(newRoleID);
    await member.roles.add(newRole);

    // Remove previous level roles
    for (const [lvl, roleID] of Object.entries(config.levelRoles)) {
      if (Number(lvl) < level) {
        await member.roles.remove(roleID);
      }
    }
  }
};
