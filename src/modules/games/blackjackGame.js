const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Player = require('../../models/Player');
const balance = require('../../modules/economy/balance');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
  formatSignedCurrency,
  getDisplayName,
} = require('../../utils/economyFeedback');

const betterOddsPlayers = new Set();
const worseOddsPlayers = new Set();

module.exports = async function playBlackjack(interaction) {
  if (!interaction.inGuild()) {
    const responseEmbed = createStatusEmbed({
      title: '❌ Guild Only',
      description: 'Blackjack can only be played inside a server.',
      color: '#FF3333',
    });
    return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
  }

  const betAmount = interaction.options.getInteger('bet');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const playerName = getDisplayName(interaction, interaction.user);

  if (betAmount <= 0) {
    const responseEmbed = createStatusEmbed({
      title: '🎲 Invalid Bet',
      description: 'Please enter a positive wager amount.',
      color: '#FF3333',
    });
    return interaction.reply({ embeds: [responseEmbed] });
  }

  const player = await Player.findOne({ userId, guildId });
  if (!player) {
    const responseEmbed = createStatusEmbed({
      title: '🎲 Blackjack Unavailable',
      description: 'You do not have an account set up yet.',
      color: '#FF3333',
    });
    return interaction.reply({ embeds: [responseEmbed] });
  }

  if (player.cash < betAmount) {
    const responseEmbed = createStatusEmbed({
      title: '🎲 Blackjack Unavailable',
      description: 'You do not have sufficient funds for this bet.',
      color: '#FF3333',
    });
    return interaction.reply({ embeds: [responseEmbed] });
  }

  const playerNetworth = player.cash + player.bank - player.debt;
  const playerComparison = await Player.compareNetWorthToTopInGuild(
    playerNetworth,
    guildId,
  );

  updateOddsState(userId, playerComparison, interaction.member.premiumSince);

  const deck = createDeck(12);
  shuffleDeck(deck);

  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  const playerHasNaturalBlackjack = isNaturalBlackjack(playerHand);
  const dealerHasNaturalBlackjack = isNaturalBlackjack(dealerHand);

  if (playerHasNaturalBlackjack || dealerHasNaturalBlackjack) {
    let result = 'push';
    let wonAmount = 0;

    if (playerHasNaturalBlackjack && !dealerHasNaturalBlackjack) {
      result = 'blackjack';
      wonAmount = Math.round(betAmount * 1.5);
    } else if (!playerHasNaturalBlackjack && dealerHasNaturalBlackjack) {
      result = 'lose';
      wonAmount = -betAmount;
    }

    const updateResult = await balance.updatePlayerCash(player, wonAmount);
    if (!updateResult.success) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Blackjack Error',
        description: updateResult.message,
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed] });
    }

    const responseEmbed = createResultEmbed({
      result,
      playerHand,
      dealerHand,
      betAmount,
      wonAmount,
      player,
      playerName,
    });

    return interaction.reply({ embeds: [responseEmbed], components: [] });
  }

  const hit = new ButtonBuilder()
    .setCustomId('hit')
    .setLabel('Hit')
    .setStyle(ButtonStyle.Primary);

  const stand = new ButtonBuilder()
    .setCustomId('stand')
    .setLabel('Stand')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(hit, stand);

  const initialEmbed = createGameEmbed(
    playerHand,
    dealerHand,
    false,
    playerName,
  );
  const replyMessage = await interaction.reply({
    embeds: [initialEmbed],
    components: [row],
    fetchReply: true,
  });

  const filter = (i) =>
    (i.customId === 'hit' || i.customId === 'stand') &&
    i.user.id === userId &&
    i.message.id === replyMessage.id;

  const collector = replyMessage.createMessageComponentCollector({
    filter,
    time: 30000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'hit') {
      if (hasBetterOdds(userId) && Math.random() < 0.7) {
        playerHand.push(drawGoodCard(deck));
      } else if (hasWorseOdds(userId) && Math.random() < 0.7) {
        playerHand.push(drawBadCard(deck));
      } else {
        playerHand.push(deck.pop());
      }

      if (isBusted(playerHand)) {
        await i.update({
          embeds: [createGameEmbed(playerHand, dealerHand, true, playerName)],
          components: [],
        });
        collector.stop('busted');
        return;
      }

      await i.update({
        embeds: [createGameEmbed(playerHand, dealerHand, false, playerName)],
        components: [row],
      });
      return;
    }

    await i.deferUpdate();
    collector.stop('stand');
  });

  collector.on('end', async (collected, reason) => {
    const playerValue = calculateValue(playerHand);
    const dealerValue = calculateValue(dealerHand);
    let result = 'tie';
    let wonAmount = 0;

    if (playerValue === 21 && dealerValue !== 21) {
      result = 'win';
    } else if (dealerValue === 21 && playerValue !== 21) {
      result = 'lose';
    } else if (playerValue === 21 && dealerValue === 21) {
      result = 'tie';
    } else if (playerValue > 21) {
      result = 'busted';
    } else if (dealerValue > 21) {
      result = 'win';
    } else if (playerValue > dealerValue) {
      result = 'win';
    } else if (playerValue < dealerValue) {
      result = 'lose';
    }

    if (result === 'win') {
      wonAmount = Math.round(betAmount * 1.5);
    } else if (result === 'lose' || result === 'busted') {
      wonAmount = -betAmount;
    }

    const updateResult = await balance.updatePlayerCash(player, wonAmount);
    if (!updateResult.success) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Blackjack Error',
        description: updateResult.message,
        color: '#FF3333',
      });
      await interaction.editReply({
        embeds: [responseEmbed],
        components: [],
      });
      return;
    }

    const responseEmbed = createResultEmbed({
      result,
      playerHand,
      dealerHand,
      betAmount,
      wonAmount,
      player,
      timeout: reason === 'time' && collected.size === 0,
      playerName,
    });

    await interaction.editReply({ embeds: [responseEmbed], components: [] });
  });
};

function updateOddsState(userId, comparison, isPremium) {
  const shouldHaveWorseOdds = comparison.percentageOfTop > 5 && !isPremium;
  const shouldHaveBetterOdds = isPremium && !comparison.isInTop;

  if (shouldHaveWorseOdds) {
    worseOddsPlayers.add(userId);
    betterOddsPlayers.delete(userId);
    return;
  }

  if (shouldHaveBetterOdds) {
    betterOddsPlayers.add(userId);
    worseOddsPlayers.delete(userId);
    return;
  }

  betterOddsPlayers.delete(userId);
  worseOddsPlayers.delete(userId);
}

function createGameEmbed(
  playerHand,
  dealerHand,
  revealDealer = false,
  playerName = 'Player',
) {
  const playerHandValue = calculateValue(playerHand);
  const dealerHandValue = calculateValue(dealerHand);
  const dealerHandString = revealDealer
    ? formatHand(dealerHand, dealerHandValue)
    : `${cardToString(dealerHand[0])} ?`;

  return createStatusEmbed({
    title: `🎲 Blackjack - ${playerName}`,
    description: 'Get as close to 21 as you can without going over.',
    color: '#0099ff',
    fields: [
      {
        name: "Dealer's Hand",
        value: dealerHandString,
        inline: false,
      },
      {
        name: 'Your Hand',
        value: formatHand(playerHand, playerHandValue),
        inline: false,
      },
    ],
  });
}

function createResultEmbed({
  result,
  playerHand,
  dealerHand,
  betAmount,
  wonAmount = 0,
  player,
  timeout = false,
  playerName = 'Player',
}) {
  const playerHandValue = calculateValue(playerHand);
  const dealerHandValue = calculateValue(dealerHand);
  const color = getResultColor(result);
  const description = getResultDescription(result, betAmount, wonAmount);

  return createBalanceEmbed({
    title: `🎲 Blackjack Results - ${playerName}`,
    description,
    cash: player.cash,
    bank: player.bank,
    debt: player.debt,
    color,
    fields: [
      {
        name: 'Outcome',
        value: getResultLabel(result),
        inline: true,
      },
      {
        name: 'Bet',
        value: formatCurrency(betAmount),
        inline: true,
      },
      {
        name: 'Change',
        value: formatSignedCurrency(wonAmount),
        inline: true,
      },
      {
        name: "Dealer's Hand",
        value:
          `${formatHand(dealerHand, dealerHandValue)}\n` +
          `Value: ${dealerHandValue}`,
        inline: false,
      },
      {
        name: 'Your Hand',
        value:
          `${formatHand(playerHand, playerHandValue)}\n` +
          `Value: ${playerHandValue}`,
        inline: false,
      },
    ],
    footer: timeout
      ? {
          text: 'Game ended due to inactivity.',
        }
      : undefined,
  });
}

function getResultLabel(result) {
  switch (result) {
    case 'blackjack':
      return 'Natural blackjack';
    case 'win':
      return 'You won';
    case 'lose':
      return 'You lost';
    case 'busted':
      return 'Bust';
    case 'push':
    case 'tie':
      return 'Push';
    default:
      return 'Completed';
  }
}

function getResultDescription(result, betAmount, wonAmount) {
  if (result === 'blackjack') {
    return `Natural blackjack. You won ${formatCurrency(wonAmount)} on a ${formatCurrency(betAmount)} bet.`;
  }

  if (result === 'win') {
    return `You won ${formatCurrency(wonAmount)} on a ${formatCurrency(betAmount)} bet.`;
  }

  if (result === 'lose' || result === 'busted') {
    return `You lost ${formatCurrency(Math.abs(wonAmount))} on a ${formatCurrency(betAmount)} bet.`;
  }

  return `Your ${formatCurrency(betAmount)} bet was returned.`;
}

function getResultColor(result) {
  if (result === 'blackjack' || result === 'win') {
    return '#00CC66';
  }

  if (result === 'lose' || result === 'busted') {
    return '#FF3333';
  }

  return '#FFD166';
}

function formatHand(hand, value) {
  return `${hand.map(cardToString).join(' ')}\nValue: ${value}`;
}

function cardToString(card) {
  return `${card.face}${card.suit}`;
}

function calculateValue(hand) {
  let value = 0;
  let aceCount = 0;

  hand.forEach((card) => {
    if (card.face === 'A') {
      aceCount++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.face)) {
      value += 10;
    } else {
      value += Number(card.face);
    }
  });

  while (value > 21 && aceCount > 0) {
    value -= 10;
    aceCount--;
  }

  return value;
}

function isBusted(playerHand) {
  return calculateValue(playerHand) > 21;
}

function isNaturalBlackjack(hand) {
  return hand.length === 2 && calculateValue(hand) === 21;
}

function createDeck(numDecks = 1) {
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
  for (let d = 0; d < numDecks; d++) {
    for (const suit of suits) {
      for (const face of faces) {
        deck.push({ suit, face });
      }
    }
  }

  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function drawBadCard(deck) {
  const badCardIndex = deck.findIndex(
    (card) => !['A', '2', '3', '4', '5', '6'].includes(card.face),
  );

  if (badCardIndex !== -1) {
    return deck.splice(badCardIndex, 1)[0];
  }

  return deck.shift();
}

function drawGoodCard(deck) {
  const goodCardIndex = deck.findIndex((card) =>
    ['A', '2', '3', '4', '5', '6'].includes(card.face),
  );

  if (goodCardIndex !== -1) {
    return deck.splice(goodCardIndex, 1)[0];
  }

  return deck.shift();
}

function hasBetterOdds(userId) {
  return betterOddsPlayers.has(userId);
}

function hasWorseOdds(userId) {
  return worseOddsPlayers.has(userId);
}

module.exports.calculateValue = calculateValue;
module.exports.createDeck = createDeck;
module.exports.drawBadCard = drawBadCard;
module.exports.drawGoodCard = drawGoodCard;
module.exports.hasBetterOdds = hasBetterOdds;
module.exports.hasWorseOdds = hasWorseOdds;
module.exports.updateOddsState = updateOddsState;
