const {setBalance} = require('../../../../modules/economy/core/setBalance');
const {fetchBalance} = require('../../../../modules/economy/core/fetchBalance');

describe('setBalance', () => {
  it('should be a function', () => {
    expect(typeof setBalance).toBe('function');
  });

  it('should set the balance for a user', async () => {
    const userId = '123456789';
    const newBalance = 1000;
    await setBalance(userId, newBalance);
    const updatedBalance = await fetchBalance(userId);
    expect(updatedBalance).toBe(newBalance);
  });

  it('should throw an error for negative balance', async () => {
    const userId = '987654321';
    const negativeBalance = -500;
    await expect(setBalance(userId, negativeBalance)).rejects.toThrow();
  });

  it('should update existing balance', async () => {
    const userId = '555555555';
    const initialBalance = 500;
    const newBalance = 750;
    await setBalance(userId, initialBalance);
    await setBalance(userId, newBalance);
    const updatedBalance = await fetchBalance(userId);
    expect(updatedBalance).toBe(newBalance);
  });

  // Add more tests as needed based on the actual implementation
});
