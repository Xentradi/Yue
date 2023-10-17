const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const coinFlip = require('../../modules/economy/games/coinFlip');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coin')
    .setDescription('Bet on heads or tails')
    .addStringOption(option =>
      option
        .setName('choice')
        .setDescription('The side you think the coin will land on')
        .setRequired(true)
        .addChoices(
          {name: 'Heads', value: 'heads'},
          {name: 'Tails', value: 'tails'}
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

  /**
   * @param {BaseInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();
    const choice = interaction.options.getString('choice');
    const betAmount = interaction.options.getInteger('bet');
    const data = await coinFlip(
      interaction.user.id,
      interaction.guildId,
      choice,
      betAmount
    );

    let embedOptions;

    if (data.success) {
      const victoryMessage = [
        'Luck is on your side!',
        'Jackpot! Well played.',
        "You've got a magic touch!",
        'Pure skill or pure luck? 😉',
      ];
      const defeatMessage = [
        'Better luck next time!',
        'Ouch! That was close.',
        'The coin gods were not in your favor.',
        'You win some, you lose some!',
      ];

      const randomMessage = data.win
        ? victoryMessage[Math.floor(Math.random() * victoryMessage.length)]
        : defeatMessage[Math.floor(Math.random() * defeatMessage.length)];

      embedOptions = {
        title: `Coin Flip Result for ${interaction.user.displayName}`,
        description: `The coin landed on **${data.outcome.toUpperCase()}**. ${randomMessage}`,
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
    } else {
      embedOptions = {
        title: 'Coin Flip Error',
        description: data.message,
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
