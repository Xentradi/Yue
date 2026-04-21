const config = require('../config.json');
const Player = require('../models/Player');
const { levelUp } = require('../utils/calculate');
const { manageRoles } = require('../utils/manageRoles');
const { withTransaction } = require('../storage/postgres');
const { bumpVersion } = require('../storage/cache');
const logger = require('../utils/logger');

/**
 * Awards a player with experience points and cash for each message they send in the guild.
 * If a player levels up, sends a celebratory message in the channel.
 * Also, handles the creation of a new player record if the player is not in the database.
 *
 * @async
 * @function
 * @param {import('discord.js').Message} message - The message sent by the player in the guild.
 * @throws Will log an error if any database operation fails.
 */

module.exports = async function messageReward(message) {
  if (!message.inGuild() || message.author.bot) return;

  const query = {
    userId: message.author.id,
    guildId: message.guild.id,
  };

  try {
    const result = await withTransaction(async (client) => {
      const player = await Player.findOne(query, { client, lock: true });

      let expToGive = getRandomExp() * (player?.expBonus || 1);
      let cashToGive = config.cashPerMessage * (player?.cashBonus || 1);

      if (message.member.premiumSince) {
        expToGive *= config.boosterExpBonus;
        cashToGive *= config.boosterCashBonus;
      }

      if (player) {
        const previousLevel = player.level;
        logger.debug(
          `Message received from existing player ${message.author.id} in ${message.guild.id}`,
        );

        logger.debug(`expToGive: ${expToGive}`);
        logger.debug(`player.exp: ${player.exp}`);

        const nextExp = player.exp + expToGive;
        const toLevelUp = levelUp(player.level);
        const nextLevel =
          nextExp >= toLevelUp ? player.level + 1 : player.level;
        const normalizedExp = nextExp >= toLevelUp ? 0 : nextExp;

        const updateResult = await player.setValues(
          {
            cash: player.cash + cashToGive,
            exp: normalizedExp,
            level: nextLevel,
          },
          { client },
        );

        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Failed to update player.');
        }

        return {
          success: true,
          leveledUp: nextLevel > previousLevel,
          level: nextLevel,
          cashToGive,
        };
      }

      const newPlayer = new Player({
        userId: message.author.id,
        guildId: message.guild.id,
        exp: expToGive,
        cash: cashToGive,
      });
      logger.debug(
        `Message received from new player ${message.author.id} in ${message.guild.id}`,
      );
      await newPlayer.save({ client });

      return {
        success: true,
        leveledUp: false,
        level: 0,
        cashToGive,
      };
    });

    if (result.success) {
      await Promise.all([
        bumpVersion('player', message.guild.id),
        bumpVersion('leaderboard', message.guild.id),
        bumpVersion('tracked'),
      ]);
    }

    if (result.success && result.leveledUp) {
      message.channel.send(
        `:tada: ${message.member} leveled up to level ${result.level}!`,
      );
      await manageRoles(message.member, result.level);
    }
  } catch (err) {
    logger.error(`Error processing messageReward: ${err}`);
  }
};

/**
 * Generates a random experience value between the minimum and maximum values specified in the config.
 *
 * @function
 * @returns {number} A random experience value.
 */
function getRandomExp() {
  const min = Math.ceil(config.minExp);
  const max = Math.floor(config.maxExp);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
