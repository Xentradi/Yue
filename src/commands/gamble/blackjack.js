const Player = require('../../models/Player');
const balance = require('../../modules/economy/balance');

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

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

    const deck = createDeck(12);
    shuffleDeck(deck);

    // Deal starting hands
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const hit = new ButtonBuilder()
      .setCustomId('hit')
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary);

    const stand = new ButtonBuilder()
      .setCustomId('stand')
      .setLabel('Stand')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(hit, stand);

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
          value: playerHand.map(card => `${card.face}${card.suit} `).join(' '),
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
        playerHand.push(deck.pop());
        if (isBusted(playerHand)) {
          await i.update({
            embeds: [createGameEmbed(playerHand, dealerHand)],
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
          dealerHand.push(deck.pop());
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

function createGameEmbed(playerHand, dealerHand) {
  return new EmbedBuilder()
    .setTitle('Blackjack')
    .addFields(
      {
        name: "Dealer's Hand",
        value: `${dealerHand[0].face}${dealerHand[0].suit} ?`,
        inline: false,
      },
      {
        name: 'Your Hand',
        value: playerHand.map(cardToString).join(' '),
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
  const baseEmbed = new EmbedBuilder()
    .setTitle('🎲 Blackjack Results 🎲')
    .addFields(
      {
        name: "🤵 Dealer's Hand",
        value: dealerHand.map(cardToString).join(' '),
        inline: false,
      },
      {
        name: '🧑‍🤝‍🧑 Your Hand',
        value: playerHand.map(cardToString).join(' '),
        inline: false,
      }
    )
    .setColor('#0099ff');

  if (result === 'win') {
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
