require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');
const logger = require('../utils/logger');

const userId = '135206040080744448';
const guildId = '1144324605599830086';

(async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    logger.info('Connected to database.');

    const player = await Player.findOne({userId, guildId});
    logger.debug(`Player Object: ${player}`);
    logger.debug(`player.cash: ${player.cash}`);
  } catch (err) {
    logger.error(err);
  }
})();
