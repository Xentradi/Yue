const { SlashCommandBuilder } = require('discord.js');
const coinFlip = require('../../modules/games/coinFlip');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coin')
    .setDescription('Bet on heads or tails.')
    .addStringOption((option) =>
      option
        .setName('choice')
        .setDescription('Your pick for the coin flip')
        .setRequired(true)
        .addChoices(
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' },
        ),
    )
    .addIntegerOption((option) =>
      option.setName('bet').setDescription('Amount to wager').setRequired(true),
    ),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Coin flips can only be played inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
    }

    await interaction.deferReply();
    const choice = interaction.options.getString('choice');
    const betAmount = interaction.options.getInteger('bet');
    const data = await coinFlip(
      interaction.user.id,
      interaction.guildId,
      choice,
      betAmount,
    );

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

      const responseEmbed = createBalanceEmbed({
        title: `🪙 Coin Flip for ${interaction.member.displayName}`,
        description: `The coin landed on **${data.outcome.toUpperCase()}**. ${randomMessage}`,
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
      return interaction.editReply({ embeds: [responseEmbed] });
    } else {
      const responseEmbed = createStatusEmbed({
        title: '⚠️ Coin Flip Failed',
        description: data.message || 'We could not complete the coin flip.',
        color: '#FF3333',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }
  },
};
