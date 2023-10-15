const {Message} = require('discord.js');
const config = require('../config.json');
const Player = require('../models/Player');
const {levelUp} = require('../utils/calculate');

module.exports = async function messageReward(message) {
  if (!message.inGuild() || message.author.bot) return;

  const query = {
    userId: message.author.id,
    guildId: message.guild.id,
  };

  try {
    const player = await Player.findOne(query);

    let expToGive = getRandomExp() * (player?.expBonus || 1);
    let cashToGive = config.cashPerMessage * (player?.cashBonus || 1);

    if (player) {
      if (message.member.roles.cache.has(config.boosterRole)) {
        expToGive *= config.boosterExpBonus;
        cashToGive *= config.boosterCashBonus;
      }
      player.exp += expToGive;
      player.cash += cashToGive;

      const toLevelUp = levelUp(player.level);
      if (player.exp >= toLevelUp) {
        player.exp = 0;
        player.level += 1;
        message.channel.send(
          `:tada: *${message.member} is ** level ${player.level}** *`
        );
      }

      await player.save();
    } else {
      const newPlayer = new Player({
        userId: message.author.id,
        guildId: message.guild.id,
        exp: expToGive,
        cash: cashToGive,
      });

      await newPlayer.save();
    }
  } catch (err) {
    console.error(err);
  }
};

function getRandomExp() {
  const min = Math.ceil(config.minExp);
  const max = Math.floor(config.maxExp);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}