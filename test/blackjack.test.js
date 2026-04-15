const assert = require('node:assert/strict');
const test = require('node:test');

const blackjack = require('../src/modules/games/blackjackGame');

test('blackjack value helper handles aces correctly', () => {
  assert.equal(
    blackjack.calculateValue([
      { face: 'A', suit: '♠' },
      { face: '9', suit: '♦' },
    ]),
    20,
  );

  assert.equal(
    blackjack.calculateValue([
      { face: 'A', suit: '♠' },
      { face: 'A', suit: '♦' },
      { face: '9', suit: '♥' },
    ]),
    21,
  );
});

test('blackjack deck helpers prefer low or high cards as intended', () => {
  const deckForGood = [
    { face: 'K', suit: '♠' },
    { face: 'A', suit: '♦' },
    { face: '7', suit: '♥' },
  ];
  const goodCard = blackjack.drawGoodCard(deckForGood);
  assert.equal(goodCard.face, 'A');
  assert.equal(deckForGood.length, 2);

  const deckForBad = [
    { face: '2', suit: '♠' },
    { face: 'K', suit: '♦' },
    { face: '6', suit: '♥' },
  ];
  const badCard = blackjack.drawBadCard(deckForBad);
  assert.equal(badCard.face, 'K');
  assert.equal(deckForBad.length, 2);
});
