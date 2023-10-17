const {SlashCommandBuilder} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Provides information about the user.'),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.reply(
      `This command was run by ${interaction.user.username} (${interaction.user.displayName}), who joined on ${interaction.member.joinedAt}.`
    );
  },
};
