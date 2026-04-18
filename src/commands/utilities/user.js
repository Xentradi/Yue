const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createStatusEmbed } = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription("View a user's profile."),
  cooldown: 3,
  deployGlobal: true,

  async execute(interaction) {
    if (!interaction.inGuild()) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Guild Only',
        description: 'User profiles are only available inside a server.',
        color: '#FF3333',
      });
      return interaction.reply({
        embeds: [responseEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = interaction.member;
    const joinedAt = member?.joinedAt
      ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`
      : 'Unknown';
    const createdAt = `<t:${Math.floor(interaction.user.createdAt.getTime() / 1000)}:F>`;

    const responseEmbed = createStatusEmbed({
      title: '👤 User Profile',
      description: `Profile details for ${member?.displayName ?? interaction.user.username}.`,
      color: '#0099ff',
      fields: [
        { name: 'Username', value: interaction.user.username, inline: true },
        {
          name: 'Display Name',
          value: member?.displayName ?? 'Unknown',
          inline: true,
        },
        { name: 'Joined Server', value: joinedAt, inline: true },
        { name: 'Account Created', value: createdAt, inline: true },
        { name: 'User ID', value: interaction.user.id, inline: false },
      ],
    });

    await interaction.reply({ embeds: [responseEmbed] });
  },
};
