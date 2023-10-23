require('dotenv').config();
const mongoose = require('mongoose');
const Lake = require('../models/Lake');
const logger = require('../utils/logger');

const guildId = '1144324605599830086';

(async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    logger.info('Connected to database.');

    const lake = await Lake.findOne({guildId});

    if (!lake) {
      logger.warn('Lake not found.');
      return;
    }

    logger.info(`Lake Object: ${JSON.stringify(lake, null, 2)}`);
    logger.info(`Fish Stock: ${JSON.stringify(lake.fishStock, null, 2)}`);

    // If you want to access properties of individual fish
    if (lake.fishStock && lake.fishStock.length > 0) {
      const firstFish = lake.fishStock[0];
      logger.info(`First Fish: ${firstFish}`);
      logger.info(`First Fish Type: ${firstFish.type}`);
      logger.info(`First Fish Count: ${firstFish.count}`);
      logger.info(`First Fish Reward ${firstFish.reward}`);
    } else {
      logger.info('No fish in the lake.');
    }
  } catch (err) {
    console.error(err);
  }
})();
