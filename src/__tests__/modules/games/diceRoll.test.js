const {DiceRoll} = require('../../../modules/games/diceRoll');

describe('DiceRoll', () => {
  let game;

  beforeEach(() => {
    game = new DiceRoll();
  });

  it('should initialize a new game', () => {
    expect(game).toBeDefined();
  });

  it('should return a number between 1 and 6', () => {
    const result = game.roll();
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(6);
  });

  it('should have an equal distribution of results', () => {
    const rolls = 6000;
    const results = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};
    for (let i = 0; i < rolls; i++) {
      results[game.roll()]++;
    }
    for (let i = 1; i <= 6; i++) {
      const percentage = results[i] / rolls;
      expect(percentage).toBeCloseTo(1 / 6, 1);
    }
  });

  it('should correctly determine if a guess is correct', () => {
    const guess = 4;
    const result = game.roll();
    expect(game.isCorrectGuess(guess, result)).toBe(guess === result);
  });

  it('should allow rolling multiple dice', () => {
    const numDice = 3;
    const results = game.rollMultiple(numDice);
    expect(results.length).toBe(numDice);
    results.forEach(result => {
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    });
  });

  // Add more tests as needed based on the actual implementation
});
