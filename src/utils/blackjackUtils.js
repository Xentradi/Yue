// ... (Your existing utility functions like createDeck, shuffleDeck, calculateValue, etc.)

// Function to create a deck
module.exports.createDeck = function () {
  // Define the cards and their values
  const suits = ['♠', '♣', '♥', '♦'];
  const faces = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
  ];
  const deck = [];
  for (const suit of suits) {
    for (const face of faces) {
      deck.push({suit, face});
    }
  }
  return deck;
};

// Function to shuffle the deck
module.exports.shuffleDeck = function (deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
};

module.exports.calculateValue = function (hand) {
  let value = 0;
  let aceCount = 0;

  hand.forEach(card => {
    if (card.face === 'A') {
      aceCount++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.face)) {
      value += 10;
    } else {
      value += Number(card.face);
    }
  });

  // Adjust the value of aces if needed
  while (value > 21 && aceCount > 0) {
    value -= 10;
    aceCount--;
  }

  return value;
};
