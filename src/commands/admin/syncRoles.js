const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Player = require('../../models/Player');
const { manageRoles } = require('../../utils/manageRoles');
const { createStatusEmbed } = require('../../utils/economyFeedback');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('syncroles')
    .setDescription('Sync level-based roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply();

    if (
      !interaction.inGuild() ||
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    try {
      const guildId = interaction.guild.id;
      const players = await Player.find({ guildId });

      if (!players || players.length === 0) {
        const responseEmbed = createStatusEmbed({
          title: '❌ No Players Found',
          description: 'No players found in the database.',
          color: '#FF0000',
        });
        return interaction.editReply({ embeds: [responseEmbed] });
      }

      await Promise.all(
        players.map(async (player) => {
          const member = await interaction.guild.members
            .fetch(player.userId)
            .catch(() => null);
          if (member) {
            await manageRoles(member, player.level);
          }
        }),
      );

      const responseEmbed = createStatusEmbed({
        title: '✅ Roles Updated',
        description: 'Roles were synchronized with stored player levels.',
        color: '#33CC33',
        fields: [
          { name: 'Members Checked', value: `${players.length}`, inline: true },
        ],
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    } catch (err) {
      logger.error(`An error occured while syncing roles: ${err}`);
      const responseEmbed = createStatusEmbed({
        title: '❌ Error',
        description: 'An error occurred while updating roles.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }
  },
};
