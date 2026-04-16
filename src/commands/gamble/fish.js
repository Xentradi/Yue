const { SlashCommandBuilder } = require('discord.js');
const fishing = require('../../modules/games/fishing');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('Fish the guild lake for rewards.'),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'Fishing can only be used inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({ embeds: [responseEmbed], ephemeral: true });
    }

    await interaction.deferReply();
    const catchResult = await fishing(interaction.user.id, interaction.guildId);

    if (!catchResult.success) {
      const responseEmbed = createStatusEmbed({
        title: '🐟 Fishing Failed',
        description:
          catchResult.description || 'Something went wrong while fishing.',
        color: '#FF3333',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    let embedOptions = {};

    switch (catchResult.type) {
      case 'Tilapia':
      case 'Salmon':
      case 'Carp':
      case 'Catfish':
      case 'Bass':
        embedOptions = {
          title: '🎣 Success!',
          description: `You caught a **${catchResult.type}** and earned ${formatCurrency(catchResult.reward)}!`,
          color: '#00FF00',
        };
        break;
      case 'Magic Koi':
      case 'Silverfin Tuna':
      case 'Neon Tetra':
      case 'Dragonfish':
        embedOptions = {
          title: '🌟 A Magical Catch!',
          description: `Wow! You caught a magical **${catchResult.type}** and earned ${formatCurrency(catchResult.reward)}!`,
          color: '#0000FF',
        };
        break;
      case 'Hostile Crab':
      case 'Angry Lobster':
        embedOptions = {
          title: '😱 Attack!',
          description: `Oh no! A **${catchResult.type}** attacked you and you lost ${formatCurrency(Math.abs(catchResult.reward))}!`,
          color: '#FF0000',
        };
        break;
      case 'Line Broke':
        embedOptions = {
          title: '😞 Unlucky!',
          description: `Your line broke and you lost ${formatCurrency(Math.abs(catchResult.reward))}. Better luck next time!`,
          color: '#808080',
        };
        break;
      default:
        embedOptions = {
          title: '🐟 No Luck!',
          description:
            'Seems like the fish are not biting today. Try again later!',
          color: '#808080',
        };
    }

    const responseEmbed = createBalanceEmbed({
      ...embedOptions,
      cash: catchResult.playerCash,
      bank: catchResult.playerBank,
      debt: catchResult.playerDebt,
    });
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
