const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { manageRoles } = require('../../utils/manageRoles');
const { createStatusEmbed } = require('../../utils/economyFeedback');
const { deferGuildInteraction } = require('../../utils/interactionHelpers');
const { canUseAdminCommands } = require('../../utils/adminPermissions');
const logger = require('../../utils/logger');
const { findPlayersByGuild } = require('../../modules/economy/playerService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('syncroles')
    .setDescription('Sync level-based roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description:
          'You need administrator permissions to execute this command.',
        title: '❌ Permission Denied',
        defer: true,
        deferOptions: {},
      }))
    ) {
      return;
    }

    if (!canUseAdminCommands(interaction)) {
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
      const endFetch = commandMetrics?.step('player fetch');
      const players = await findPlayersByGuild(guildId, {
        select: 'userId level -_id',
        lean: true,
      });
      endFetch?.();

      if (!players || players.length === 0) {
        const endRender = commandMetrics?.step('response build');
        const responseEmbed = createStatusEmbed({
          title: '❌ No Players Found',
          description: 'No players found in the database.',
          color: '#FF0000',
        });
        endRender?.();
        return interaction.editReply({ embeds: [responseEmbed] });
      }

      const endSync = commandMetrics?.step('role sync');
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
      endSync?.();

      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '✅ Roles Updated',
        description: 'Roles were synchronized with stored player levels.',
        color: '#33CC33',
        fields: [
          { name: 'Members Checked', value: `${players.length}`, inline: true },
        ],
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    } catch (err) {
      logger.error(`An error occurred while syncing roles: ${err}`);
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '❌ Error',
        description: 'An error occurred while updating roles.',
        color: '#FF0000',
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }
  },
};
