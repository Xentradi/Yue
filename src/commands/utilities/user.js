const {SlashCommandBuilder} = require('discord.js');
const {convertToSeconds} = require('../../utils/calculate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Provides information about the user.'),
  cooldown: convertToSeconds('1s'),
  deployGlobal: true,

  async execute(interaction) {
    await interaction.reply(
      `This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`
    );
  },
};
