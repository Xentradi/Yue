const { SlashCommandBuilder } = require('discord.js');
const { createStatusEmbed } = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get support and invite information.'),
  cooldown: 1,
  deployGlobal: true,
  async execute(interaction) {
    const supportEmbed = createStatusEmbed({
      title: 'Need Support?',
      description:
        'Join the support server for help, bug reports, and questions.',
      color: '#0099ff',
      fields: [
        {
          name: 'Support Server',
          value: '[Open the invite](https://discord.gg/KF5fbWsKdz)',
          inline: false,
        },
      ],
      footer: { text: 'Yue Support' },
    });

    await interaction.reply({ embeds: [supportEmbed] });
  },
};
