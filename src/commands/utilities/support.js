const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get support information.'),
  cooldown: 1,
  deployGlobal: true,
  async execute(interaction) {
    const supportEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Need Support?')
      .setDescription(
        'For support, please visit [Our Support Server](https://discord.gg/KF5fbWsKdz)'
      )
      .setFooter({text: 'Bot Support Command'});

    await interaction.reply({embeds: [supportEmbed]});
  },
};
