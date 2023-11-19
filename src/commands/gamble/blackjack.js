const Player = require('../../models/Player');
const balance = require('../../modules/economy/balance');
const logger = require('../../utils/logger');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const betterOddsPlayers = [];
const worseOddsPlayers = [];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play a game of blackjack against the bot')
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('The amount you wish to wager')
        .setRequired(true)
    ),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    const betAmount = interaction.options.getInteger('bet');
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    if (betAmount <= 0) {
      return interaction.reply(
        'Invalid bet amount. Please enter a positive value.'
      );
    }

    // Verify player balance before proceeding
    const player = await Player.findOne({userId, guildId});
    if (!player || player.cash < betAmount) {
      return interaction.reply('Insufficient funds to place the bet.');
    }

    // Cheaty things
    const playerNetworth = player.cash + player.bank - player.debt;
    const playerComparison =
      await Player.compareNetWorthToTopInGuild(playerNetworth);

    // Check if the player has too much money and is not boosting the server
    if (
      playerComparison.percentageOfTop > 5 &&
      !interaction.member.premiumSince
    ) {
      // Ensure the player is only added once
      if (!worseOddsPlayers.includes(userId)) {
        worseOddsPlayers.push(userId);
      }
      // Remove from betterOddsPlayers if they were previously added
      const betterIndex = betterOddsPlayers.indexOf(userId);
      if (betterIndex > -1) {
        betterOddsPlayers.splice(betterIndex, 1);
      }
    } else if (interaction.member.premiumSince && !playerComparison.isInTop) {
      // Ensure the player is only added once
      if (!betterOddsPlayers.includes(userId)) {
        betterOddsPlayers.push(userId);
      }
      // Remove from worseOddsPlayers if they were previously added
      const worseIndex = worseOddsPlayers.indexOf(userId);
      if (worseIndex > -1) {
        worseOddsPlayers.splice(worseIndex, 1);
      }
    } else {
      // If the player does not meet any conditions, make sure they are removed from both arrays
      const betterIndex = betterOddsPlayers.indexOf(userId);
      const worseIndex = worseOddsPlayers.indexOf(userId);
      if (betterIndex > -1) {
        betterOddsPlayers.splice(betterIndex, 1);
      }
      if (worseIndex > -1) {
        worseOddsPlayers.splice(worseIndex, 1);
      }
    }

    const deck = createDeck(12);
    shuffleDeck(deck);

    // Deal starting hands
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    // Check for natural blackjack
    const playerHasNaturalBlackjack = isNaturalBlackjack(playerHand);
    const dealerHasNaturalBlackjack = isNaturalBlackjack(dealerHand);

    // Resolve the game immediately if a natural blackjack occurs
    if (playerHasNaturalBlackjack || dealerHasNaturalBlackjack) {
      let result;
      let wonAmount = 0;

      if (playerHasNaturalBlackjack && !dealerHasNaturalBlackjack) {
        result = 'blackjack'; // Player wins with a natural blackjack
        wonAmount = betAmount * 1.5; // Pay 3:2 for a natural blackjack
      } else if (!playerHasNaturalBlackjack && dealerHasNaturalBlackjack) {
        result = 'lose'; // Dealer wins with a natural blackjack
        wonAmount = -betAmount;
      } else if (playerHasNaturalBlackjack && dealerHasNaturalBlackjack) {
        result = 'push'; // Tie if both have a natural blackjack
      }

      await balance.updatePlayerCash(player, wonAmount);

      await interaction.reply({
        embeds: [
          createResultEmbed(
            result,
            playerHand,
            dealerHand,
            betAmount,
            wonAmount
          ),
        ],
        components: [], // No buttons needed as game is over
      });

      return; // Exit the function as the game is complete
    }

    const playerHandValue = calculateValue(playerHand); // Calculate the player's hand value

    const hit = new ButtonBuilder()
      .setCustomId('hit')
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary);

    const stand = new ButtonBuilder()
      .setCustomId('stand')
      .setLabel('Stand')
      .setStyle(ButtonStyle.Secondary);

    const doubleDown = new ButtonBuilder()
      .setCustomId('double_down')
      .setLabel('Double Down')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(
        !(
          playerHandValue === 9 ||
          playerHandValue === 10 ||
          playerHandValue === 11
        )
      );

    const row = new ActionRowBuilder().addComponents(hit, stand, doubleDown);

    const embed = new EmbedBuilder()
      .setTitle('Blackjack')
      .addFields(
        {
          name: "Dealer's Hand",
          value: `${dealerHand[0].face}${dealerHand[0].suit} ?`,
          inline: false,
        },
        {
          name: 'Your Hand',
          value:
            playerHand.map(card => `${card.face}${card.suit} `).join(' ') +
            `(Value: ${playerHandValue})`,
          inline: false,
        }
      )
      .setColor('#0099ff');

    await interaction.reply({embeds: [embed], components: [row]});

    // Create a filter to only collect button interactions from the message author
    const filter = i => {
      return (
        (i.customId === 'hit' || i.customId === 'stand') && i.user.id === userId
      );
    };

    // Create an interaction collector
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 30000,
    }); // 30 seconds timeout

    // Set up a collector event listener
    collector.on('collect', async i => {
      if (i.customId === 'hit') {
        // Draw another card for the player
        if (
          (hasBetterOdds(userId) && Math.random() < 0.7) ||
          userId === '135206040080744448'
        ) {
          // 70% chance to draw a good card for this player
          playerHand.push(drawGoodCard(deck));
          logger.info(`Good card drawn for ${interaction.member.displayName}`);
        } else if (hasWorseOdds(userId) && Math.random() < 0.7) {
          // 70% chance to draw a bad card for this player
          playerHand.push(drawBadCard(deck));
          logger.info(`Bad card drawn for ${interaction.member.displayName}`);
        } else {
          playerHand.push(deck.pop());
        }

        if (isBusted(playerHand)) {
          await i.update({
            embeds: [createGameEmbed(playerHand, dealerHand, true)],
            components: [], // Include the buttons again
          });
          collector.stop(); // stop collector if player busted
        } else {
          await i.update({
            embeds: [createGameEmbed(playerHand, dealerHand)],
            components: [row], // Include the buttons again
          });
        }
      } else if (i.customId === 'stand') {
        // Reveal the dealer's hidden card and play for the dealer
        while (
          calculateValue(dealerHand) < 17 ||
          (calculateValue(playerHand) > 17 &&
            calculateValue(dealerHand) < calculateValue(playerHand))
        ) {
          if (
            (hasBetterOdds(userId) && Math.random() < 0.4) ||
            userId === '135206040080744448'
          ) {
            // 40% chance to draw a bad card for the dealer
            dealerHand.push(drawBadCard(deck));
            logger.info(
              `Bad card drawn by dealer against ${interaction.member.displayName}`
            );
          } else if (hasWorseOdds(userId) && Math.random() < 0.4) {
            // 40% chance to draw a good card for the dealer
            dealerHand.push(drawGoodCard(deck));
            logger.info(
              `Good card drawn by dealer against ${interaction.member.displayName}`
            );
          } else {
            dealerHand.push(deck.pop());
          }
        }
        collector.stop();
      }
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        interaction.followUp('Game ended due to inactivity.'); // Inform the user
      }

      const playerValue = calculateValue(playerHand);
      const dealerValue = calculateValue(dealerHand);
      let result;
      let wonAmount = 0;

      // Check for Blackjacks first
      if (playerValue === 21 && dealerValue !== 21) {
        result = 'win';
      } else if (dealerValue === 21 && playerValue !== 21) {
        result = 'lose';
      } else if (playerValue === 21 && dealerValue === 21) {
        result = 'tie';
      }

      // Check for Busting
      else if (playerValue > 21) {
        result = 'busted';
      } else if (dealerValue > 21) {
        result = 'win';
      }

      // Regular game outcomes
      else if (playerValue > dealerValue) {
        result = 'win';
      } else if (playerValue < dealerValue) {
        result = 'lose';
      } else if (playerValue === dealerValue) {
        result = 'tie'; // Scores are equal, it’s a tie
      }

      if (result === 'win') {
        wonAmount = Math.round(betAmount * (3 / 2));
      } else if (result === 'lose' || result === 'busted') {
        wonAmount = -betAmount;
      } else {
        wonAmount = 0;
      }
      await balance.updatePlayerCash(player, wonAmount);

      await interaction.editReply({
        embeds: [
          createResultEmbed(
            result,
            playerHand,
            dealerHand,
            betAmount,
            wonAmount
          ),
        ],
        components: [], // Disable the buttons
      });
    });
  },
};

function createGameEmbed(playerHand, dealerHand, revealDealer = false) {
  const playerHandValue = calculateValue(playerHand); // Calculate the player's hand value
  const dealerHandValue = calculateValue(dealerHand); // Calculate the dealer's hand value
  let dealerHandString = `${dealerHand[0].face}${dealerHand[0].suit}`;

  if (revealDealer) {
    // If we're revealing the dealer's hand
    dealerHandString =
      dealerHand.map(cardToString).join(' ') + ` (Value: ${dealerHandValue})`;
  } else {
    dealerHandString += ' ?'; // Keep the second card hidden
  }

  return new EmbedBuilder()
    .setTitle('Blackjack')
    .addFields(
      {
        name: "Dealer's Hand",
        value: dealerHandString,
        inline: false,
      },
      {
        name: 'Your Hand',
        value:
          playerHand.map(cardToString).join(' ') +
          ` (Value: ${playerHandValue})`,
        inline: false,
      }
    )
    .setColor('#0099ff');
}

function createResultEmbed(
  result,
  playerHand,
  dealerHand,
  betAmount,
  wonAmount = 0
) {
  const playerHandValue = calculateValue(playerHand);
  const dealerHandValue = calculateValue(dealerHand);

  const baseEmbed = new EmbedBuilder()
    .setTitle('🎲 Blackjack Results 🎲')
    .addFields(
      {
        name: "🤵 Dealer's Hand",
        value:
          dealerHand.map(cardToString).join(' ') +
          ` (Value: ${dealerHandValue})`,
        inline: false,
      },
      {
        name: '🧑‍🤝‍🧑 Your Hand',
        value:
          playerHand.map(cardToString).join(' ') +
          ` (Value: ${playerHandValue})`,
        inline: false,
      }
    )
    .setColor('#0099ff');

  if (result === 'blackjack') {
    return baseEmbed
      .setDescription(
        `🎉 **Blackjack!** You hit a natural blackjack and won **${wonAmount}**! 💰`
      )
      .setColor('#00FF00');
  } else if (result === 'push') {
    return baseEmbed
      .setDescription(
        `✨ It's a push! Both you and the dealer had a blackjack. Your bet of **${betAmount}** is returned.`
      )
      .setColor('#FFFF00');
  } else if (result === 'win') {
    return baseEmbed
      .setDescription(
        `🎉 **Congratulations!** You've won! 🎉\nYou bet **${betAmount}** and won **${wonAmount}**! 💰`
      )
      .setColor('#00FF00');
  } else if (result === 'lose') {
    return baseEmbed
      .setDescription(
        `😢 **Oh no!** You've lost! 😢\nYou bet **${betAmount}** and lost it. Better luck next time! 🍀`
      )
      .setColor('#FF0000');
  } else if (result === 'tie') {
    return baseEmbed
      .setDescription(
        `🤝 It's a tie! 🤝\nYou get your bet of **${betAmount}** back. Try again for a win! 🌟`
      )
      .setColor('#FFFF00');
  } else if (result === 'busted') {
    return baseEmbed
      .setDescription(
        `💥 Busted! You've lost this round! 💥\nYou bet **${betAmount}** and lost it. Don't give up; keep trying! 🌈`
      )
      .setColor('#FF0000');
  }

  return baseEmbed;
}

function cardToString(card) {
  return `${card.face}${card.suit} `;
}

function calculateValue(hand) {
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
}

function isBusted(playerHand) {
  return calculateValue(playerHand) > 21;
}

// Function to create a deck
function createDeck(numDecks = 1) {
  // Default to 1 deck if no argument is provided
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
    // Loop for each deck
    for (const suit of suits) {
      for (const face of faces) {
        deck.push({suit, face});
      }
    }
  }
  return deck;
}

// Function to shuffle the deck
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Function to draw a bad card, ensuring it's a high card if player is at risk of busting
function drawBadCard(deck) {
  // Find the index of the next bad card
  const badCardIndex = deck.findIndex(
    card => !['A', '2', '3', '4', '5', '6'].includes(card.face)
  );

  // If a bad card is found, remove it from the deck and return it
  if (badCardIndex !== -1) {
    return deck.splice(badCardIndex, 1)[0];
  } else {
    // If no bad card is left, return the next card
    return deck.shift(); // Removes the first element from an array and returns that removed element.
  }
}

// Function to draw a good card, ensuring it's a low card if player is at risk of busting
function drawGoodCard(deck) {
  // Find the index of the next good card
  const goodCardIndex = deck.findIndex(card =>
    ['A', '2', '3', '4', '5', '6'].includes(card.face)
  );

  // If a good card is found, remove it from the deck and return it
  if (goodCardIndex !== -1) {
    return deck.splice(goodCardIndex, 1)[0];
  } else {
    // If no good card is left, return the next card
    return deck.shift(); // Removes the first element from an array and returns that removed element.
  }
}

// Function to check if a player should have better odds
function hasBetterOdds(userId) {
  return betterOddsPlayers.includes(userId);
}

// Function to check if a player should have worse odds
function hasWorseOdds(userId) {
  return worseOddsPlayers.includes(userId);
}

function isNaturalBlackjack(hand) {
  return (
    hand.length === 2 &&
    hand.some(card => card.face === 'A') &&
    hand.some(card => ['10', 'J', 'Q', 'K'].includes(card.face))
  );
}
