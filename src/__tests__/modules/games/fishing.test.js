const {FishingGame} = require('../../../modules/games/fishing');

describe('FishingGame', () => {
  let game;

  beforeEach(() => {
    game = new FishingGame();
  });

  it('should initialize a new game', () => {
    expect(game).toBeDefined();
    expect(game.inventory).toEqual([]);
  });

  it('should be able to cast a line', () => {
    const result = game.castLine();
    expect(result).toBeDefined();
  });

  it('should sometimes catch a fish', () => {
    const attempts = 100;
    let caughtFish = false;
    for (let i = 0; i < attempts; i++) {
      const result = game.castLine();
      if (result.caught) {
        caughtFish = true;
        break;
      }
    }
    expect(caughtFish).toBe(true);
  });

  it('should add caught fish to inventory', () => {
    const initialInventorySize = game.inventory.length;
    game.catchFish('Salmon');
    expect(game.inventory.length).toBe(initialInventorySize + 1);
    expect(game.inventory).toContain('Salmon');
  });

  it('should calculate total catch value', () => {
    game.catchFish('Salmon');
    game.catchFish('Trout');
    const totalValue = game.calculateTotalValue();
    expect(totalValue).toBeGreaterThan(0);
  });

  it('should have different types of fish', () => {
    const fishTypes = new Set();
    const attempts = 1000;
    for (let i = 0; i < attempts; i++) {
      const result = game.castLine();
      if (result.caught) {
        fishTypes.add(result.fish);
      }
    }
    expect(fishTypes.size).toBeGreaterThan(1);
  });

  // Add more tests as needed based on the actual implementation
});
