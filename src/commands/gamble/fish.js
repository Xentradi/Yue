const {SlashCommandBuilder} = require('discord.js');
const fishing = require('../../modules/economy/games/fishing');
const {convertToSeconds} = require('../../utils/calculate');
const {MessageEmbed} = require('discord.js');

module.exports = {
  cooldown: convertToSeconds('5s'),
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('Try your luck and fish in the virtual lake.'),

  async execute(interaction) {
    await interaction.deferReply();
    const catchResult = await fishing(interaction.user.id, interaction.guildId);

    const embed = new MessageEmbed();

    switch (catchResult.type) {
      case 'Tilapia':
      case 'Salmon':
      case 'Carp':
      case 'Catfish':
      case 'Bass':
        embed
          .setTitle('🎣 Success!')
          .setDescription(
            `You caught a **${catchResult.type}** and earned $${catchResult.reward}!`
          )
          .setColor('GREEN');
        break;
      case 'Magic Koi':
      case 'Silverfin Tuna':
      case 'Neon Tetra':
      case 'Dragonfish':
        embed
          .setTitle('🌟 A Magical Catch!')
          .setDescription(
            `Wow! You caught a magical **${catchResult.type}** and earned $${catchResult.reward}!`
          )
          .setColor('BLUE');
        break;
      case 'Hostile Crab':
      case 'Angry Lobster':
        embed
          .setTitle('😱 Attack!')
          .setDescription(
            `Oh no! A **${
              catchResult.type
            }** attacked you and you lost $${Math.abs(catchResult.reward)}!`
          )
          .setColor('RED');
        break;
      case 'Line Broke':
        embed
          .setTitle('😞 Unlucky!')
          .setDescription(
            `Your line broke and you lost $${Math.abs(
              catchResult.reward
            )}. Better luck next time!`
          )
          .setColor('GREY');
        break;
      default:
        embed
          .setTitle('🐟 No Luck!')
          .setDescription(
            'Seems like the fish are not biting today. Try again later!'
          )
          .setColor('GREY');
    }

    interaction.editReply({embeds: [embed]});
  },
};
