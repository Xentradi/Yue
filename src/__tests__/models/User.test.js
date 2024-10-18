const mongoose = require('mongoose');
const User = require('../../models/User');

// Mock mongoose
jest.mock('mongoose', () => ({
  Schema: jest.fn(),
  model: jest.fn(),
  Schema: {
    prototype: {
      index: jest.fn(),
    },
  },
}));

describe('User Model', () => {
  it('should create a new User model', () => {
    expect(mongoose.model).toHaveBeenCalledWith('User', expect.any(mongoose.Schema));
  });

  it('should have the correct fields', () => {
    const userSchema = mongoose.Schema.mock.calls[0][0];
    expect(userSchema).toHaveProperty('discordUserId');
    expect(userSchema).toHaveProperty('vipLevel');
    expect(userSchema).toHaveProperty('vipPoints');
    expect(userSchema).toHaveProperty('vipExperienceMultiplier');
    expect(userSchema).toHaveProperty('vipCurrencyMultiplier');
    expect(userSchema).toHaveProperty('vipInterestMultiplier');
  });

  it('should have required discordUserId field', () => {
    const userSchema = mongoose.Schema.mock.calls[0][0];
    expect(userSchema.discordUserId.required).toBe(true);
  });

  it('should have unique discordUserId field', () => {
    const userSchema = mongoose.Schema.mock.calls[0][0];
    expect(userSchema.discordUserId.unique).toBe(true);
  });

  it('should have default values for VIP fields', () => {
    const userSchema = mongoose.Schema.mock.calls[0][0];
    expect(userSchema.vipLevel.default).toBe(0);
    expect(userSchema.vipPoints.default).toBe(0);
    expect(userSchema.vipExperienceMultiplier.default).toBe(1.0);
    expect(userSchema.vipCurrencyMultiplier.default).toBe(1.0);
    expect(userSchema.vipInterestMultiplier.default).toBe(1.0);
  });

  it('should create an index on userId', () => {
    expect(mongoose.Schema.prototype.index).toHaveBeenCalledWith({userId: 1});
  });
});
