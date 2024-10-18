const cron = require('node-cron');
const applyBankInterest = require('../../../modules/economy/bankOperations/interest');
const restockLake = require('../../../modules/games/adminOperations/restockLake');
const logger = require('../../../utils/logger');

jest.mock('node-cron');
jest.mock('../../../modules/economy/bankOperations/interest');
jest.mock('../../../modules/games/adminOperations/restockLake');
jest.mock('../../../utils/logger');

describe('Scheduled Tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should schedule daily tasks', () => {
    require('../../../modules/scheduledEvents/scheduledTasks');

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 12 * * *',
      expect.any(Function),
      expect.objectContaining({
        scheduled: true,
        timezone: 'Etc/UTC',
      })
    );
  });

  it('should schedule hourly tasks', () => {
    require('../../../modules/scheduledEvents/scheduledTasks');

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 * * * *',
      expect.any(Function),
      expect.objectContaining({
        scheduled: true,
        timezone: 'Etc/UTC',
      })
    );
  });

  it('should call applyBankInterest and restockLake in daily tasks', async () => {
    require('../../../modules/scheduledEvents/scheduledTasks');

    const dailyCallback = cron.schedule.mock.calls.find(call => call[0] === '0 12 * * *')[1];

    applyBankInterest.mockResolvedValue({message: 'Interest applied'});
    restockLake.mockResolvedValue({message: 'Lake restocked'});

    await dailyCallback();

    expect(applyBankInterest).toHaveBeenCalled();
    expect(restockLake).toHaveBeenCalledWith(5500);
    expect(logger.info).toHaveBeenCalledWith('Interest applied');
    expect(logger.info).toHaveBeenCalledWith('Lake restocked');
  });

  it('should call restockLake in hourly tasks', async () => {
    require('../../../modules/scheduledEvents/scheduledTasks');

    const hourlyCallback = cron.schedule.mock.calls.find(call => call[0] === '0 * * * *')[1];

    restockLake.mockResolvedValue({message: 'Lake restocked'});

    await hourlyCallback();

    expect(restockLake).toHaveBeenCalledWith(500);
    expect(logger.info).toHaveBeenCalledWith('Lake restocked');
  });

  it('should handle errors in daily tasks', async () => {
    require('../../../modules/scheduledEvents/scheduledTasks');

    const dailyCallback = cron.schedule.mock.calls.find(call => call[0] === '0 12 * * *')[1];

    applyBankInterest.mockRejectedValue(new Error('Interest error'));
    restockLake.mockRejectedValue(new Error('Restock error'));

    await dailyCallback();

    expect(logger.error).toHaveBeenCalledWith(new Error('Interest error'));
    expect(logger.error).toHaveBeenCalledWith(new Error('Restock error'));
  });

  it('should handle errors in hourly tasks', async () => {
    require('../../../modules/scheduledEvents/scheduledTasks');

    const hourlyCallback = cron.schedule.mock.calls.find(call => call[0] === '0 * * * *')[1];

    restockLake.mockRejectedValue(new Error('Hourly restock error'));

    await hourlyCallback();

    expect(logger.error).toHaveBeenCalledWith(new Error('Hourly restock error'));
  });
});
