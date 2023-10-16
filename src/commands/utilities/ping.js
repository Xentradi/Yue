const {SlashCommandBuilder} = require('discord.js');
const {convertToSeconds} = require('../../utils/calculate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  cooldown: convertToSeconds('1s'),
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;
    interaction.editReply(
      `Pong! Client: ${ping}ms | Websocket: ${interaction.client.ws.ping}ms`
    );
  },
};
