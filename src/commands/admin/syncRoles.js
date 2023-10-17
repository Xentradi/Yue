const {SlashCommandBuilder} = require('discord.js');
const Player = require('../../models/Player');
const {manageRoles} = require('../../utils/manageRoles');
const {createEmbed} = require('../../utils/embedUtils');
const {convertToSeconds} = require('../../utils/calculate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('syncroles')
    .setDescription(
      'Reconscile roles to users based on their levels in the database.'
    ),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply();

    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      const responseEmbed = createEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({embeds: [responseEmbed]});
    }

    try {
      const guildId = interaction.guild.id;
      const players = await Player.find({guildId});

      if (!players || players.length === 0) {
        const responseEmbed = createEmbed({
          title: '❌ No Players Found',
          description: 'No players found in the database.',
          color: '#FF0000',
        });
        return interaction.editReply({embeds: [responseEmbed]});
      }

      players.forEach(async player => {
        const member = await interaction.guild.members.fetch(player.userId);
        if (member) {
          await manageRoles(member, player.level);
        }
      });

      const responseEmbed = createEmbed({
        title: '✅ Roles Updated',
        description:
          'Roles have been successfully updated based on player levels.',
        color: '#00FF00',
      });
      interaction.editReply({embeds: [responseEmbed]});
    } catch (err) {
      console.error(err);
      const responseEmbed = createEmbed({
        title: '❌ Error',
        description: 'An error occurred while updating roles.',
        color: '#FF0000',
      });
      interaction.editReply({embeds: [responseEmbed]});
    }
  },
};
