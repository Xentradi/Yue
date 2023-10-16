const {SlashCommandBuilder} = require('discord.js');
const restockLake = require('../../modules/economy/games/restockLake');
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restocklake')
    .setDescription('Restock the virtual lake with new fish.')
    .addIntegerOption(option =>
      option
        .setName('lake_size')
        .setDescription('How many fish you want to stock in the lake')
        .setRequired(false)
    ),
  cooldown: convertToSeconds('10m'),
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

    const lakeSize = interaction.options.getInteger('lake_size') || 1000;

    if (lakeSize <= 0) {
      const responseEmbed = createEmbed({
        title: '❌ Invalid Lake Size',
        description: 'Please provide a positive integer for the lake size.',
        color: '#FF0000',
      });
      return interaction.editReply({embeds: [responseEmbed]});
    }

    const restockResult = await restockLake(interaction.guildId, lakeSize);

    let embedOptions = {
      title: '🐟 Lake Restocked!',
      description: `The lake has been restocked successfully! ${restockResult.newFishCount} new fish have been added.`,
      color: '#00FF00',
    };

    if (!restockResult.success) {
      embedOptions = {
        title: '❌ Restock Failed',
        description: restockResult.message,
        color: '#FF0000',
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
