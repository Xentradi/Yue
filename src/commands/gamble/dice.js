const { SlashCommandBuilder } = require('discord.js');
const diceRoll = require('../../modules/games/diceRoll');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');
const { deferGuildInteraction } = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Bet on a six-sided roll.')
    .addIntegerOption((option) =>
      option
        .setName('guess')
        .setDescription('Your guessed roll outcome')
        .setRequired(true)
        .addChoices(
          { name: '1', value: 1 },
          { name: '2', value: 2 },
          { name: '3', value: 3 },
          { name: '4', value: 4 },
          { name: '5', value: 5 },
          { name: '6', value: 6 },
        ),
    )
    .addIntegerOption((option) =>
      option.setName('bet').setDescription('Amount to wager').setRequired(true),
    ),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Dice rolls can only be played inside a server.',
      }))
    ) {
      return;
    }

    const guessedNumber = interaction.options.getInteger('guess');
    const betAmount = interaction.options.getInteger('bet');

    const endGame = commandMetrics?.step('dice roll');
    const data = await diceRoll(
      interaction.user.id,
      interaction.guildId,
      guessedNumber,
      betAmount,
    );
    endGame?.();

    if (!data.success) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '🎲 Dice Roll Failed',
        description: data.message || 'We could not complete the dice roll.',
        color: '#FF3333',
      });
      endRender?.();
      return interaction.reply({ embeds: [responseEmbed] });
    }

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

    const responseEmbed = createBalanceEmbed({
      title: `🎲 Dice Roll for ${interaction.member.displayName}`,
      description: `The dice rolled **${data.outcome}**. ${randomMessage}`,
      cash: data.playerBalanceAfter,
      bank: 0,
      debt: 0,
      fields: [
        {
          name: data.win ? '🎉 You Won!' : '😢 You Lost!',
          value: data.win
            ? `You won ${formatCurrency(data.prize)}.`
            : `You lost ${formatCurrency(Math.abs(data.prize))}.`,
          inline: false,
        },
        {
          name: '🎲 Bet',
          value: formatCurrency(data.betAmount),
          inline: true,
        },
      ],
    });
    const endRender = commandMetrics?.step('response build');
    endRender?.();
    return interaction.reply({ embeds: [responseEmbed] });
  },
};
