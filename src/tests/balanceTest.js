require('dotenv').config();
const mongoose = require('mongoose');
const Player = require('../models/Player');

const userId = '135206040080744448';
const guildId = '1144324605599830086';

(async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to database.');

    const player = await Player.findOne({userId, guildId});

    console.log(`Player Object: ${player}`);
    console.log(`player.cash: ${player.cash}`);
  } catch (err) {
    console.error(err);
  }
})();
