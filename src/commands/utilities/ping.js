const { SlashCommandBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { createStatusEmbed } = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency.'),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    const reply = await interaction.reply({
      content: 'Calculating latency...',
      fetchReply: true,
    });
    const ping = reply.createdTimestamp - interaction.createdTimestamp;
    logger.info(
      `Pong! Client ${ping}ms | Websocket: ${interaction.client.ws.ping}ms`,
    );
    commandMetrics?.step('response build')();
    const responseEmbed = createStatusEmbed({
      title: '🏓 Pong!',
      description: `Client latency: ${ping}ms\nWebsocket latency: ${interaction.client.ws.ping}ms`,
      color: '#33CC33',
    });
    return interaction.editReply({ content: null, embeds: [responseEmbed] });
  },
};
