const cron = require('node-cron');
const applyBankInterest = require('../modules/economy/bankOperations/interest');
const restockLake = require('../modules/economy/games/restockLake');

// Daily
cron.schedule(
  '0 12 * * *',
  () => {
    applyBankInterest()
      .then(response => console.log(response.message))
      .catch(error => console.error(error));
    restockLake(5500)
      .then(response => console.log(response.message))
      .catch(error => console.error(error));
  },
  {
    scheduled: true,
    timezone: 'Etc/UTC',
  }
);

// Hourly
cron.schedule(
  '0 * * * *',
  () => {
    restockLake(500)
      .then(response => console.log(response.message))
      .catch(error => console.error(error));
  },
  {
    scheduled: true,
    timezone: 'Etc/UTC',
  }
);
