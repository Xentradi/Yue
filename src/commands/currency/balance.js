const {SlashCommandBuilder} = require('discord.js');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Shows your balance.'),
  async execute(interaction) {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;
    interaction.editReply(
      `Pong! Client: ${ping}ms | Websocket: ${interaction.client.ws.ping}ms`
    );
  },
};
