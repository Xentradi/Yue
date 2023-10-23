const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');
const logger = require('../../utils/logger');

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

// Function to create a deck
function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const face of faces) {
      deck.push({suit, face});
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjacktest')
    .setDescription('Play a game of blackjack against the bot'),
  cooldown: 3,
  deployGlobal: false,

  async execute(interaction) {
    logger.info(
      `Command ${interaction.commandName} invoked by ${
        interaction.user.tag
      } with arguments ${interaction.options._hoistedOptions
        .map(option => `${option.name}: ${option.value}`)
        .join(', ')}`
    );
    const deck = createDeck();
    shuffleDeck(deck);

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
          name: 'Your Hand',
          value: playerHand.map(card => `${card.face}${card.suit} `).join(' '),
          inline: true,
        },
        {
          name: "Dealer's Hand",
          value: `${dealerHand[0].face}${dealerHand[0].suit} ?`,
          inline: true,
        }
      )
      .setColor('#0099ff');

    await interaction.reply({embeds: [embed], components: [row]});

    // Create a filter to only collect button interactions from the message author
    const filter = i => {
      return (
        i.customId === 'hit' ||
        (i.customId === 'stand' && i.user.id === interaction.user.id)
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

        // Check if the player is busted
        if (calculateValue(playerHand) > 21) {
          await i.update({
            embeds: [
              createResultEmbed('Busted! You lost.', playerHand, dealerHand),
            ],
            components: [], // Disable the buttons
          });
          collector.stop();
          return;
        }
      } else if (i.customId === 'stand') {
        // Reveal the dealer's hidden card and play for the dealer
        while (calculateValue(dealerHand) < 17) {
          dealerHand.push(deck.pop());
        }

        const playerValue = calculateValue(playerHand);
        const dealerValue = calculateValue(dealerHand);

        let result;
        if (dealerValue > 21 || playerValue > dealerValue) {
          result = 'Congratulations! You won.';
        } else if (playerValue < dealerValue) {
          result = 'Sorry! You lost.';
        } else {
          result = "It's a tie!";
        }

        await i.update({
          embeds: [createResultEmbed(result, playerHand, dealerHand)],
          components: [], // Disable the buttons
        });
        collector.stop();
        return;
      }
      // Update the embed for the next interaction
      await i.update({
        embeds: [createGameEmbed(playerHand, dealerHand)],
      });
    });

    collector.on('end', collected => {
      //console.log(`Collected ${collected.size} interactions.`);
    });
  },
};

function createGameEmbed(playerHand, dealerHand) {
  return new EmbedBuilder()
    .setTitle('Blackjack')
    .addFields(
      {
        name: 'Your Hand',
        value: playerHand.map(cardToString).join(' '),
        inline: true,
      },
      {
        name: "Dealer's Hand",
        value: `${dealerHand[0].face}${dealerHand[0].suit} ?`,
        inline: true,
      }
    )
    .setColor('#0099ff');
}

function createResultEmbed(result, playerHand, dealerHand) {
  return new EmbedBuilder()
    .setTitle('Blackjack')
    .setDescription(result)
    .addFields(
      {
        name: 'Your Hand',
        value: playerHand.map(cardToString).join(' '),
        inline: true,
      },
      {
        name: "Dealer's Hand",
        value: dealerHand.map(cardToString).join(' '),
        inline: true,
      }
    )
    .setColor('#0099ff');
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
