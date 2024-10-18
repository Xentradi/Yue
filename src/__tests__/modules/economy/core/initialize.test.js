const {initialize} = require('../../../../modules/economy/core/initialize');

describe('initialize', () => {
  it('should be a function', () => {
    expect(typeof initialize).toBe('function');
  });

  it('should initialize a user with default balance', async () => {
    const userId = '123456789';
    const result = await initialize(userId);
    expect(result).toEqual(expect.objectContaining({
      userId: userId,
      balance: expect.any(Number),
    }));
  });

  it('should not reinitialize an existing user', async () => {
    const userId = '987654321';
    await initialize(userId);
    const result = await initialize(userId);
    expect(result).toBeNull();
  });

  // Add more tests as needed based on the actual implementation
});
