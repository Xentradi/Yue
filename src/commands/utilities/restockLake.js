const {SlashCommandBuilder, permissions, MessageEmbed} = require('discord.js');
const restockLake = require('../../modules/economy/games/restockLake');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restocklake')
    .setDescription('Restock the virtual lake with fish. (Admin Only)'),

  async execute(interaction) {
    await interaction.deferReply({ephemeral: true});

    // Check if the user has administrator permissions
    const member = interaction.member;
    if (!member.permissions.has(permissions.FLAGS.ADMINISTRATOR)) {
      const embed = new MessageEmbed()
        .setTitle('Permission Denied')
        .setDescription(
          'You need administrator permissions to execute this command.'
        )
        .setColor('RED');
      return interaction.editReply({embeds: [embed]});
    }

    // Execute the restocking function and get the result
    const restockResult = await restockLake(interaction.guildId);

    const embed = new MessageEmbed()
      .setTitle('🐟 Lake Restocked!')
      .setDescription(
        `The lake has been restocked with **${restockResult.totalFish}** fish.`
      )
      .setColor('GREEN');

    interaction.editReply({embeds: [embed]});
  },
};
