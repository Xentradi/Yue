const {Events} = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    require('../utils/scheduledTasks');
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
