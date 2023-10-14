const {Events} = require('discord.js');
const {messageReward} = require('../modules/messageReward');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    messageReward(message);
  },
};
