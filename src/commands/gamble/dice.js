const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const diceRoll = require('../../modules/economy/games/diceRoll');
const {createEmbed} = require('../../utils/embedUtils');
const logger = require('../../utils/logger');
const Player = require('../../models/Player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Bet on the outcome of a dice roll (1-6)')
    .addIntegerOption(option =>
      option
        .setName('guess')
        .setDescription('Your guessed outcome of the dice roll')
        .setRequired(true)
        .addChoices(
          {name: '1', value: 1},
          {name: '2', value: 2},
          {name: '3', value: 3},
          {name: '4', value: 4},
          {name: '5', value: 5},
          {name: '6', value: 6}
        )
    )
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('The amount you wish to wager')
        .setRequired(true)
    ),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    logger.info(
      `Command ${interaction.commandName} invoked by ${
        interaction.user.tag
      } with arguments ${interaction.options._hoistedOptions
        .map(option => `${option.name}: ${option.value}`)
        .join(', ')}`
    );
    await interaction.deferReply();

    const guessedNumber = interaction.options.getInteger('guess');
    const betAmount = interaction.options.getInteger('bet');

    // Fetch the player from the database
    const player = await Player.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // Check if the player exists and has sufficient funds
    if (!player) {
      await interaction.reply('You do not have an account set up.');
      return; // Exit early
    } else if (player.cash < betAmount) {
      await interaction.reply('You do not have sufficient funds for this bet.');
      return; // Exit early
    }

    const data = await diceRoll(
      interaction.user.id,
      interaction.guildId,
      guessedNumber,
      betAmount
    );

    const victoryMessage = [
      'Bullseye! Right on the mark.',
      'Whoa! Did you predict that?',
      'Impressive call!',
      'Maybe you should buy a lottery ticket? 😜',
    ];
    const defeatMessage = [
      'Missed it by a hair!',
      'Dice can be unpredictable!',
      'So close, yet so far.',
      'Keep rolling! Fortune favors the persistent.',
    ];

    const randomMessage = data.win
      ? victoryMessage[Math.floor(Math.random() * victoryMessage.length)]
      : defeatMessage[Math.floor(Math.random() * defeatMessage.length)];

    const embedOptions = {
      title: `Dice Roll Result for ${interaction.member.displayName}`,
      description: `The dice rolled **${data.outcome}**. ${randomMessage}`,
      fields: [
        {
          name: data.win ? '🎉 You Won!' : '😢 You Lost!',
          value: data.win
            ? `You won $${data.prize}.`
            : `You lost $${Math.abs(data.prize)}.`,
          inline: false,
        },
      ],
    };

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
