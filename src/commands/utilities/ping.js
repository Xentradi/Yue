const {SlashCommandBuilder} = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;
    logger.info(
      `Pong! Client ${ping}ms | Websocket: ${interaction.client.ws.ping}ms`
    );
    interaction.editReply(
      `Pong! Client: ${ping}ms | Websocket: ${interaction.client.ws.ping}ms`
    );
  },
};
