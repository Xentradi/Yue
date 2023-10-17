const cron = require('node-cron');
const applyBankInterest = require('../modules/economy/bankOperations/interest');

cron.schedule(
  '0 12 * * *',
  () => {
    applyBankInterest()
      .then(response => console.log(response.message))
      .catch(error => console.error(error));
  },
  {
    scheduled: true,
    timezone: 'Etc/UTC',
  }
);
