jest.mock('../../data/characterClasses.json', () => ({
  Warrior: {
    Knight: {
      strength: 5,
      dexterity: 3,
      intelligence: 2,
      charisma: 3,
      spirit: 2,
      focus: 2,
      endurance: 4,
      luck: 1,
      alchemy: 1,
      crafting: 2
    }
  },
  Mage: {
    Wizard: {
      strength: 1,
      dexterity: 2,
      intelligence: 5,
      charisma: 2,
      spirit: 4,
      focus: 4,
      endurance: 2,
      luck: 1,
      alchemy: 3,
      crafting: 1
    }
  }
}), {virtual: true});

const {findBaseStats} = require('../../utils/characterUtils');

describe('characterUtils', () => {
  describe('findBaseStats', () => {
    it('should return correct base stats for existing class', () => {
      const knightStats = findBaseStats('Knight');
      expect(knightStats).toEqual({
        strength: 5,
        dexterity: 3,
        intelligence: 2,
        charisma: 3,
        spirit: 2,
        focus: 2,
        endurance: 4,
        luck: 1,
        alchemy: 1,
        crafting: 2
      });

      const wizardStats = findBaseStats('Wizard');
      expect(wizardStats).toEqual({
        strength: 1,
        dexterity: 2,
        intelligence: 5,
        charisma: 2,
        spirit: 4,
        focus: 4,
        endurance: 2,
        luck: 1,
        alchemy: 3,
        crafting: 1
      });
    });

    it('should return default stats for non-existent class', () => {
      const defaultStats = findBaseStats('NonExistentClass');
      expect(defaultStats).toEqual({
        strength: 1,
        dexterity: 1,
        intelligence: 1,
        charisma: 1,
        spirit: 1,
        focus: 1,
        endurance: 1,
        luck: 1,
        alchemy: 1,
        crafting: 1
      });
    });
  });
});
