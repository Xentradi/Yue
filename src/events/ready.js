const {Events} = require('discord.js');
//const reminderMessages = require('../modules/scheduledEvents/reminderMessages');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    require('../modules/scheduledEvents/scheduledTasks');
    //reminderMessages.cronJobs(client);
    logger.info(`Ready! Logged in as ${client.user.tag}`);
  },
};
