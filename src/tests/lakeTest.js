require('dotenv').config();
const mongoose = require('mongoose');
const Lake = require('../models/Lake');

const guildId = '1144324605599830086';

(async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to database.');

    const lake = await Lake.findOne({guildId});

    if (!lake) {
      console.log('Lake not found.');
      return;
    }

    console.log('Lake Object:', JSON.stringify(lake, null, 2));
    console.log('Fish Stock:', JSON.stringify(lake.fishStock, null, 2));

    // If you want to access properties of individual fish
    if (lake.fishStock && lake.fishStock.length > 0) {
      const firstFish = lake.fishStock[0];
      console.log('First Fish:', firstFish);
      console.log('First Fish Type:', firstFish.type);
      console.log('First Fish Count:', firstFish.count);
      console.log('First Fish Reward:', firstFish.reward);
    } else {
      console.log('No fish in the lake.');
    }
  } catch (err) {
    console.error(err);
  }
})();
