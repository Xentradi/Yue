const mongoose = require('mongoose');
const Bank = require('../../models/Bank');

// Mock mongoose
jest.mock('mongoose', () => ({
  Schema: jest.fn(() => ({
    index: jest.fn(),
  })),
  model: jest.fn(),
  Schema: {
    Types: {
      ObjectId: 'ObjectId',
    },
  },
}));

describe('Bank Model', () => {
  let bankSchema;

  beforeEach(() => {
    jest.clearAllMocks();
    bankSchema = mongoose.Schema.mock.calls[0][0];
  });

  it('should create a new Bank model', () => {
    expect(mongoose.model).toHaveBeenCalledWith('Bank', expect.any(mongoose.Schema));
  });

  it('should have the correct fields', () => {
    expect(bankSchema).toHaveProperty('accountId');
    expect(bankSchema).toHaveProperty('playerId');
    expect(bankSchema).toHaveProperty('accountType');
    expect(bankSchema).toHaveProperty('balance');
    expect(bankSchema).toHaveProperty('interestRate');
    expect(bankSchema).toHaveProperty('lastInterestUpdate');
  });

  it('should have required fields', () => {
    expect(bankSchema.accountId.required).toBe(true);
    expect(bankSchema.playerId.required).toBe(true);
    expect(bankSchema.accountType.required).toBe(true);
  });

  it('should have default values', () => {
    expect(bankSchema.balance.default).toBe(0);
    expect(bankSchema.interestRate.default).toBe(0);
    expect(bankSchema.lastInterestUpdate.default).toBe(null);
  });

  it('should use ObjectId for accountId and playerId', () => {
    expect(bankSchema.accountId.type).toBe(mongoose.Schema.Types.ObjectId);
    expect(bankSchema.playerId.type).toBe(mongoose.Schema.Types.ObjectId);
  });

  it('should reference Player model for playerId', () => {
    expect(bankSchema.playerId.ref).toBe('Player');
  });

  it('should create an index on playerId', () => {
    expect(mongoose.Schema().index).toHaveBeenCalledWith({playerId: 1});
  });
});
