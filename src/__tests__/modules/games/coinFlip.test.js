const {CoinFlip} = require('../../../modules/games/coinFlip');

describe('CoinFlip', () => {
  let game;

  beforeEach(() => {
    game = new CoinFlip();
  });

  it('should initialize a new game', () => {
    expect(game).toBeDefined();
  });

  it('should return either "heads" or "tails"', () => {
    const result = game.flip();
    expect(['heads', 'tails']).toContain(result);
  });

  it('should have a 50% chance of heads or tails', () => {
    const flips = 1000;
    let heads = 0;
    for (let i = 0; i < flips; i++) {
      if (game.flip() === 'heads') {
        heads++;
      }
    }
    const headsPercentage = heads / flips;
    expect(headsPercentage).toBeCloseTo(0.5, 1);
  });

  it('should correctly determine if a guess is correct', () => {
    const guess = 'heads';
    const result = game.flip();
    expect(game.isCorrectGuess(guess, result)).toBe(guess === result);
  });

  // Add more tests as needed based on the actual implementation
});
