const mongoose = require('mongoose');
const Character = require('../../models/Character');
const characterUtils = require('../../utils/characterUtils');
const logger = require('../../utils/logger');

// Mock mongoose
jest.mock('mongoose', () => ({
  Schema: jest.fn(() => ({
    index: jest.fn(),
    method: jest.fn(),
  })),
  model: jest.fn(),
}));

// Mock characterUtils
jest.mock('../../utils/characterUtils', () => ({
  findBaseStats: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Character Model', () => {
  let characterSchema;

  beforeEach(() => {
    jest.clearAllMocks();
    characterSchema = mongoose.Schema.mock.calls[0][0];
  });

  it('should create a new Character model', () => {
    expect(mongoose.model).toHaveBeenCalledWith('Character', expect.any(mongoose.Schema));
  });

  it('should have the correct fields', () => {
    expect(characterSchema).toHaveProperty('discordUserId');
    expect(characterSchema).toHaveProperty('guildId');
    expect(characterSchema).toHaveProperty('level');
    expect(characterSchema).toHaveProperty('exp');
    expect(characterSchema).toHaveProperty('reputation');
    expect(characterSchema).toHaveProperty('characterClass');
    expect(characterSchema).toHaveProperty('stats');
    expect(characterSchema).toHaveProperty('currency');
    expect(characterSchema).toHaveProperty('equipment');
    expect(characterSchema).toHaveProperty('inventory');
    expect(characterSchema).toHaveProperty('lastDailyClaim');
  });

  it('should have required fields', () => {
    expect(characterSchema.discordUserId.required).toBe(true);
    expect(characterSchema.guildId.required).toBe(true);
    expect(characterSchema.characterClass.required).toBe(true);
  });

  it('should have default values', () => {
    expect(characterSchema.level.default).toBe(1);
    expect(characterSchema.exp.default).toBe(0);
    expect(characterSchema.reputation.default).toBe(0);
    expect(characterSchema.currency.standard.default).toBe(0);
    expect(characterSchema.currency.premium.default).toBe(0);
  });

  it('should create an index on discordUserId and guildId', () => {
    expect(mongoose.Schema().index).toHaveBeenCalledWith({discordUserId: 1, guildId: 1});
  });

  describe('calculateTotalStats method', () => {
    it('should calculate total stats correctly', () => {
      const mockCharacter = {
        characterClass: 'Warrior',
        equipment: {
          mainHand: {statBonuses: {strength: 5}},
          offHand: {statBonuses: {dexterity: 3}},
        },
      };

      characterUtils.findBaseStats.mockReturnValue({strength: 10, dexterity: 8});

      const calculateTotalStats = mongoose.Schema().method.mock.calls.find(call => call[0] === 'calculateTotalStats')[1];
      const result = calculateTotalStats.call(mockCharacter);

      expect(result).toEqual({strength: 15, dexterity: 11});
    });
  });

  describe('equipItem method', () => {
    it('should equip item and save character', async () => {
      const mockCharacter = {
        equipment: {},
        calculateTotalStats: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
      };

      const equipItem = mongoose.Schema().method.mock.calls.find(call => call[0] === 'equipItem')[1];
      const result = await equipItem.call(mockCharacter, 'mainHand', {name: 'Sword'});

      expect(mockCharacter.equipment.mainHand).toEqual({name: 'Sword'});
      expect(mockCharacter.calculateTotalStats).toHaveBeenCalled();
      expect(mockCharacter.save).toHaveBeenCalled();
      expect(result).toEqual({success: true, message: 'Item equipped successfully.'});
    });

    it('should handle errors when equipping item', async () => {
      const mockCharacter = {
        equipment: {},
        calculateTotalStats: jest.fn(),
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      };

      const equipItem = mongoose.Schema().method.mock.calls.find(call => call[0] === 'equipItem')[1];
      const result = await equipItem.call(mockCharacter, 'mainHand', {name: 'Sword'});

      expect(logger.error).toHaveBeenCalled();
      expect(result).toEqual({success: false, message: 'Error equiping item.'});
    });
  });

  describe('addExperience method', () => {
    it('should add experience and level up character', async () => {
      const mockCharacter = {
        level: 1,
        exp: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      const addExperience = mongoose.Schema().method.mock.calls.find(call => call[0] === 'addExperience')[1];
      const result = await addExperience.call(mockCharacter, 1000);

      expect(mockCharacter.exp).toBe(1000);
      expect(mockCharacter.level).toBe(2);
      expect(mockCharacter.save).toHaveBeenCalled();
      expect(result).toEqual({success: true, message: 'Experience added successfully.'});
    });

    it('should handle errors when adding experience', async () => {
      const mockCharacter = {
        level: 1,
        exp: 0,
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      };

      const addExperience = mongoose.Schema().method.mock.calls.find(call => call[0] === 'addExperience')[1];
      const result = await addExperience.call(mockCharacter, 1000);

      expect(logger.error).toHaveBeenCalled();
      expect(result).toEqual({success: false, message: 'Error adding experience.'});
    });
  });
});
