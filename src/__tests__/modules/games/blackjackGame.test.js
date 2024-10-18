const {BlackjackGame} = require('../../../modules/games/blackjackGame');

describe('BlackjackGame', () => {
  let game;

  beforeEach(() => {
    game = new BlackjackGame();
  });

  it('should initialize a new game', () => {
    expect(game).toBeDefined();
    expect(game.playerHand).toEqual([]);
    expect(game.dealerHand).toEqual([]);
  });

  it('should deal initial hands', () => {
    game.dealInitialHands();
    expect(game.playerHand.length).toBe(2);
    expect(game.dealerHand.length).toBe(2);
  });

  it('should calculate hand value correctly', () => {
    game.playerHand = [{value: 10}, {value: 5}];
    expect(game.calculateHandValue(game.playerHand)).toBe(15);
  });

  it('should handle ace value correctly', () => {
    game.playerHand = [{value: 11}, {value: 5}];
    expect(game.calculateHandValue(game.playerHand)).toBe(16);
    game.playerHand.push({value: 10});
    expect(game.calculateHandValue(game.playerHand)).toBe(16);
  });

  it('should determine winner correctly', () => {
    game.playerHand = [{value: 10}, {value: 9}];
    game.dealerHand = [{value: 10}, {value: 8}];
    expect(game.determineWinner()).toBe('player');

    game.dealerHand = [{value: 10}, {value: 10}];
    expect(game.determineWinner()).toBe('dealer');

    game.playerHand = [{value: 10}, {value: 10}];
    expect(game.determineWinner()).toBe('tie');
  });

  // Add more tests as needed based on the actual implementation
});
