const {Message} = require('discord.js');
const config = require('../config.json');
const Player = require('../models/Player');
const calculate = require('../utils/calculate');

module.exports = {messageReward};

/**
 *
 * @param {Message} message
 *
 */
async function messageReward(message) {
  if (!message.inGuild() || message.author.bot) return;

  const query = {
    userId: message.author.id,
    guildId: message.guild.id,
  };

  try {
    const player = await Player.findOne(query);

    let expToGive = getRandomExp();
    let cashToGive = config.cashPerMessage;

    // new player
    if (!player) {
      const newPlayer = new Player({
        userId: message.author.id,
        guildId: message.guild.id,
        exp: expToGive,
        cash: cashToGive,
      });
      newPlayer.save().catch(e => {
        console.error(`Error saving new player ${e}`);
        return;
      });
    }

    // existing player
    if (player) {
      // Add multipliers to the gained exp and cash
      expToGive *= player.expBonus;
      cashToGive *= player.cashBonus;
      if (message.member.roles.cache.has(config.boosterRole)) {
        expToGive *= config.boosterExpBonus;
        cashToGive *= config.boosterCashBonus;
      }

      player.exp += expToGive;
      player.cash += cashToGive;

      // check if the player will level up with the gained exp
      const toLevelUp = calculate.levelUp(player.level + 1);
      if (player.exp >= toLevelUp) {
        player.exp = 0;
        player.level += 1;
        message.channel.send(
          `:tada: *${message.member} is ** level ${player.level}** *`
        );
      }
      console.log(player);
      player.save().catch(e => {
        console.error(`Error saving updated player ${e}`);
        return;
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function getRandomExp() {
  const min = Math.ceil(config.minExp);
  const max = Math.floor(config.maxExp);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
