const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const restockLake = require('../../modules/games/adminOperations/restockLake');
const {
  createConfirmationEmbed,
  createStatusEmbed,
} = require('../../utils/economyFeedback');
const {
  deferGuildInteraction,
  getOptionInteger,
} = require('../../utils/interactionHelpers');
const { promptForConfirmation } = require('../../utils/confirmationFlow');

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
        deferOptions: { flags: MessageFlags.Ephemeral },
      }))
    ) {
      return;
    }

    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }

    let lakeSize = getOptionInteger(interaction, 'lake_size', 'size') || 1000;

    if (lakeSize <= 0) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Invalid Lake Size',
        description: 'Please provide a positive integer for the lake size.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }
    if (lakeSize > 1000000) lakeSize = 1000000;

    const endPreview = commandMetrics?.step('response build');
    const previewEmbed = createConfirmationEmbed(
      buildConfirmationPreview(interaction, lakeSize),
    );
    endPreview?.();

    try {
      const confirmed = await promptForConfirmation(interaction, previewEmbed);
      if (!confirmed) {
        return;
      }

      const endOperation = commandMetrics?.step('restock');
      const restockResult = await restockLake(interaction.guildId, lakeSize);
      endOperation?.();

      const endRender = commandMetrics?.step('response build');
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
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    } catch (error) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Restock Failed',
        description: error.message || 'The restock could not be completed.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }
  },
};

module.exports.buildConfirmationPreview = buildConfirmationPreview;

function buildConfirmationPreview(interaction, lakeSize) {
  const channelLabel = interaction.channel?.name
    ? `#${interaction.channel.name}`
    : 'the current channel';

  return {
    title: '⚠️ Are you sure?',
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
