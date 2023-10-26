const {SlashCommandBuilder} = require('discord.js');
const fishing = require('../../modules/games/fishing');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('Try your luck and fish in the virtual lake.'),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply();
    const catchResult = await fishing(interaction.user.id, interaction.guildId);

    let embedOptions = {};

    switch (catchResult.type) {
      case 'Tilapia':
      case 'Salmon':
      case 'Carp':
      case 'Catfish':
      case 'Bass':
        embedOptions = {
          title: '🎣 Success!',
          description: `You caught a **${catchResult.type}** and earned $${catchResult.reward}!`,
          color: '#00FF00',
        };
        break;
      case 'Magic Koi':
      case 'Silverfin Tuna':
      case 'Neon Tetra':
      case 'Dragonfish':
        embedOptions = {
          title: '🌟 A Magical Catch!',
          description: `Wow! You caught a magical **${catchResult.type}** and earned $${catchResult.reward}!`,
          color: '#0000FF',
        };
        break;
      case 'Hostile Crab':
      case 'Angry Lobster':
        embedOptions = {
          title: '😱 Attack!',
          description: `Oh no! A **${
            catchResult.type
          }** attacked you and you lost $${Math.abs(catchResult.reward)}!`,
          color: '#FF0000',
        };
        break;
      case 'Line Broke':
        embedOptions = {
          title: '😞 Unlucky!',
          description: `Your line broke and you lost $${Math.abs(
            catchResult.reward
          )}. Better luck next time!`,
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

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
