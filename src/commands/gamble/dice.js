const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const diceRoll = require('../../modules/economy/games/diceRoll');
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  cooldown: convertToSeconds('3s'),
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

  async execute(interaction) {
    await interaction.deferReply();
    const guessedNumber = interaction.options.getInteger('guess');
    const betAmount = interaction.options.getInteger('bet');
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
      title: `Dice Roll Result for ${interaction.user.username}`,
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
