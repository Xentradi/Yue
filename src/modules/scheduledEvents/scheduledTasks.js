const cron = require('node-cron');
const applyBankInterest = require('../economy/bankOperations/interest');
const restockLake = require('../games/adminOperations/restockLake');
const logger = require('../../utils/logger');

// Daily
cron.schedule(
  '0 12 * * *',
  () => {
    applyBankInterest()
      .then(response => logger.info(response.message))
      .catch(error => logger.error(error));
    restockLake(5500)
      .then(response => logger.info(response.message))
      .catch(error => logger.error(error));
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
      .then(response => logger.info(response.message))
      .catch(error => logger.error(error));
  },
  {
    scheduled: true,
    timezone: 'Etc/UTC',
  }
);

// Daily
