const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const restockLake = require('../../modules/games/adminOperations/restockLake');
const {
  createConfirmationEmbed,
  createStatusEmbed,
} = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restocklake')
    .setDescription('Restock the guild lake.')
    .addIntegerOption((option) =>
      option
        .setName('lake_size')
        .setDescription('How many fish you want to stock in the lake')
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName('confirm')
        .setDescription('Confirm this destructive change before applying it')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
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

    let lakeSize = interaction.options.getInteger('lake_size') || 1000;
    const confirm = interaction.options.getBoolean('confirm') ?? false;

    if (lakeSize <= 0) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Invalid Lake Size',
        description: 'Please provide a positive integer for the lake size.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }
    if (lakeSize > 1000000) lakeSize = 1000000;

    if (!confirm) {
      const responseEmbed = createConfirmationEmbed(
        buildConfirmationPreview(interaction, lakeSize),
      );
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const restockResult = await restockLake(interaction.guildId, lakeSize);

    const responseEmbed = restockResult.success
      ? createStatusEmbed({
          title: '🐟 Lake Restocked',
          description: `The lake now holds ${restockResult.newFishCount.toLocaleString()} fish total.`,
          color: '#33CC33',
          fields: [
            {
              name: 'Lake Size',
              value: `${restockResult.newFishCount.toLocaleString()} fish`,
              inline: true,
            },
          ],
        })
      : createStatusEmbed({
          title: '❌ Restock Failed',
          description: restockResult.message,
          color: '#FF0000',
        });
    interaction.editReply({ embeds: [responseEmbed] });
  },
};

module.exports.buildConfirmationPreview = buildConfirmationPreview;

function buildConfirmationPreview(interaction, lakeSize) {
  const channelLabel = interaction.channel?.name
    ? `#${interaction.channel.name}`
    : 'the current channel';

  return {
    title: '⚠️ Confirm Lake Restock',
    description: `This will replace the current lake stock in ${channelLabel} with ${lakeSize.toLocaleString()} fish.`,
    fields: [
      { name: 'Target Channel', value: channelLabel, inline: true },
      {
        name: 'Lake Size',
        value: `${lakeSize.toLocaleString()} fish`,
        inline: true,
      },
    ],
  };
}
