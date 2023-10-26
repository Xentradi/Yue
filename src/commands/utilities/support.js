const {SlashCommandBuilder, MessageEmbed} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get support information.'),
  async execute(interaction) {
    const supportEmbed = new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Need Support?')
      .setDescription(
        'For support, please visit [Our Support Server](https://discord.gg/KF5fbWsKdz)'
      )
      .setFooter('Bot Support Command');

    await interaction.reply({embeds: [supportEmbed]});
  },
};
