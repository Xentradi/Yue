const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');
const {convertToSeconds} = require('../../utils/calculate');
const Player = require('../../models/Player'); // Ensure the path is correct

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

  cooldown: convertToSeconds('3s'),
  deployGlobal: false,

  async execute(interaction) {
    const betAmount = interaction.options.getInteger('bet');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const player = await Player.findOne({userId, guildId});

    if (!player) return null;

    if (player.cash < betAmount) {
      result.message = 'Insufficient funds to place the bet.';
      return result;
    }

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
          value: playerHand.map(card => `${card.face}${card.suit}`).join(' '),
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
          addUserCurrency(interaction.user.id, betAmount);
        } else if (playerValue < dealerValue) {
          result = 'Sorry! You lost.';
          subtractUserCurrency(interaction.user.id, betAmount);
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

function createResultEmbed(result, playerHand, dealerHand, bet, win) {
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
      },
      {
        name: 'Result',
        value: win ? `You won $${bet}` : `You lost $${bet}`,
        inline: false,
      }
    )
    .setColor('#0099ff');
}

function cardToString(card) {
  return `${card.face}${card.suit}`;
}
